module.exports = function (fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  // A list of HTTP methods that need to be modified
  const httpMethods = ['post', 'patch', 'put', 'get', 'delete'];

  // Helper function to process http.* handlers and replace req.body with jsonBody
  const processHttpMethodHandler = (httpCallPath) => {


    let handlerFunction = null;
    if (!httpCallPath.node) {
      handlerFunction = httpCallPath.nodes()[0];
    } else {
     handlerFunction = httpCallPath.node.arguments?.[1];  // Safely access arguments[1]
    }

    //const handlerFunction = httpCallPath.node.arguments[1];

    if (handlerFunction && handlerFunction.type === 'ArrowFunctionExpression') {
      // Step 2: Ensure the handler is async
      if (!handlerFunction.async) {
        handlerFunction.async = true;
      }

      // Step 3: Search for req.body references in the function body
      let bodyReferences = j(handlerFunction.body)
        .find(j.MemberExpression, {
          object: { name: 'req' },
          property: { name: 'body' }
        });

      if (bodyReferences.size() > 0) {
        // Step 4: Ensure jsonBody is declared only once
        const jsonBodyExists = j(handlerFunction.body)
          .find(j.VariableDeclarator, { id: { name: 'jsonBody' } })
          .size() > 0;

        if (!jsonBodyExists) {
          // Insert `const jsonBody = await request.json()` at the start of the function body
          const jsonBodyDeclaration = j.variableDeclaration('const', [
            j.variableDeclarator(
              j.identifier('jsonBody'),
              j.awaitExpression(
                j.callExpression(
                  j.memberExpression(j.identifier('request'), j.identifier('json')),
                  []
                )
              )
            )
          ]);

          handlerFunction.body.body.unshift(jsonBodyDeclaration);
        }

        // Step 5: Replace all `req.body` references with `jsonBody`
        bodyReferences.replaceWith(j.identifier('jsonBody'));
      }
    }
  };

  // Step 1: Find all CallExpressions that are http.* calls (whether as direct calls or as arguments to other functions)
  root.find(j.CallExpression).forEach(path => {
    if (
      path.node.callee.type === 'MemberExpression' &&
      path.node.callee.object.name === 'http' &&
      httpMethods.includes(path.node.callee.property.name)
    ) {
      // Found a direct http.* call (e.g., http.post, http.get)
      processHttpMethodHandler(path);
    } else if (path.node.arguments.length > 0) {
      // Check if any of the arguments to this call are http.* calls
      path.node.arguments.forEach(arg => {
        if (
          arg.type === 'CallExpression' &&
          arg.callee.type === 'MemberExpression' &&
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
