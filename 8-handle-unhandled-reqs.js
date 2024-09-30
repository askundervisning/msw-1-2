module.exports = function (fileInfo, api) {
    const j = api.jscodeshift;
    const root = j(fileInfo.source);
  
    // A list of HTTP methods that need to be modified
    const httpMethods = ['post', 'patch', 'put', 'get', 'delete'];
  
    // Helper function to replace `req.headers` and `req.url` with `request.headers` and `request.url`
    const replaceReqWithRequest = (functionBody) => {
      // Replace `req.headers` with `request.headers`
      j(functionBody)
        .find(j.MemberExpression, {
          object: { name: 'req' },
          property: { name: 'headers' }
        })
        .forEach(path => {
          path.get('object').replace(j.identifier('request'));
        });
  
      // Replace `req.url` with `request.url`
      j(functionBody)
        .find(j.MemberExpression, {
          object: { name: 'req' },
          property: { name: 'url' }
        })
        .forEach(path => {
          path.get('object').replace(j.identifier('request'));
        });

        j(functionBody)
        .find(j.MemberExpression, {
          object: { name: 'req' },
          property: { name: 'method' }
        })
        .forEach(path => {
          path.get('object').replace(j.identifier('request'));
        });
    };
  
    // Helper function to process http.* handlers and replace req.headers/req.url with request.headers/request.url
    const processHttpMethodHandler = (httpCallPath) => {
      const handlerFunction = httpCallPath.node.arguments?.[1];  // Safely access arguments[1]
  
      if (handlerFunction && (handlerFunction.type === 'ArrowFunctionExpression' || handlerFunction.type === 'FunctionExpression')) {
        // Replace `req.headers` and `req.url` with `request.headers` and `request.url` in the function body
        replaceReqWithRequest(handlerFunction.body);
      }
    };
  
    // Step 1: Find all CallExpressions that are http.* calls (whether as array elements or arguments to other functions)
    root.find(j.CallExpression).forEach(path => {
      if (
        path.node.callee?.type === 'MemberExpression' &&
        path.node.callee.object.name === 'http' &&
        httpMethods.includes(path.node.callee.property.name)
      ) {
        // Found a direct http.* call (e.g., http.post, http.get)
        processHttpMethodHandler(path);
      } else if (path.node.arguments?.length > 0) {
        // Check if any of the arguments to this call are http.* calls
        path.node.arguments.forEach(arg => {
          if (
            arg?.type === 'CallExpression' &&
            arg.callee?.type === 'MemberExpression' &&
            arg.callee.object.name === 'http' &&
            httpMethods.includes(arg.callee.property.name)
          ) {
            // Found an http.* call passed as an argument
            processHttpMethodHandler(j(arg));
          }
        });
      }
    });
  
    // Return the modified source code
    return root.toSource();
  };
  