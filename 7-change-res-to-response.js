module.exports = function (fileInfo, api) {
    const j = api.jscodeshift;
    const root = j(fileInfo.source);
  
    // A list of HTTP methods that need to be modified
    const httpMethods = ['post', 'patch', 'put', 'get', 'delete'];
    let hasTransformed = false; // Flag to track if we have transformed any code
  
    // Helper function to replace `res()` call with `HttpResponse.json()` or `HttpResponse.text()` or `HttpResponse.body()`
    const replaceResWithHttpResponse = (path, responseType, jsonOrTextCall, statusNode, headers) => {
      const initObjectProperties = [];
  
      // Include status if present
      if (statusNode) {
        initObjectProperties.push(j.property('init', j.identifier('status'), statusNode));
      }
  
      // Include headers if present
      if (headers.length > 0) {
        const headerObject = j.objectExpression(
          headers.map(header => j.property('init', j.identifier(header.key), header.value))
        );
        initObjectProperties.push(j.property('init', j.identifier('headers'), headerObject));
      }
  
      // Create the HttpResponse call
      const newHttpResponseCall = j.callExpression(
        j.memberExpression(
          j.identifier('HttpResponse'),
          j.identifier(jsonOrTextCall) // json, text, or body
        ),
        [
          responseType, // First argument (the body, empty for text)
          initObjectProperties.length > 0 ? j.objectExpression(initObjectProperties) : null // Second argument (init object)
        ].filter(Boolean) // Remove nulls
      );
  
      // Replace the res() call with HttpResponse.json() or HttpResponse.text() or HttpResponse.body()
      path.replace(newHttpResponseCall);
      hasTransformed = true; // Mark that we have transformed the code
    };
  
    // Step 1: Find all HTTP method handlers (post, put, get, etc.)
    root
      .find(j.CallExpression)
      .filter(path => {
        return (
          path.node.callee.type === 'MemberExpression' &&
          path.node.callee.object.name === 'http' &&
          httpMethods.includes(path.node.callee.property.name)
        );
      })
      .forEach(path => {
        const handlerFunction = path.node.arguments[1];
  
        if (handlerFunction && handlerFunction.type === 'ArrowFunctionExpression') {
          // Step 2: Find all `res()` calls in the function
          j(handlerFunction.body)
            .find(j.CallExpression, { callee: { name: 'res' } })
            .forEach(resCallPath => {
              let jsonArgument = null;
              let bodyArgument = null;
              let statusNode = null;
              const headers = [];
  
              // Loop through all arguments in the `res()` call
              resCallPath.node.arguments.forEach(arg => {
                if (
                  arg.callee &&
                  arg.callee.object.name === 'ctx' &&
                  arg.callee.property.name === 'json'
                ) {
                  jsonArgument = arg.arguments[0]; // Capture the `foo` in `ctx.json(foo)`
                }
  
                if (
                  arg.callee &&
                  arg.callee.object.name === 'ctx' &&
                  arg.callee.property.name === 'body'
                ) {
                  bodyArgument = arg.arguments[0]; // Capture the `foo` in `ctx.body(foo)`
                }
  
                if (
                  arg.callee &&
                  arg.callee.object.name === 'ctx' &&
                  arg.callee.property.name === 'status'
                ) {
                  statusNode = arg.arguments[0]; // Capture the `code` in `ctx.status(code)`
                }
  
                if (
                  arg.callee &&
                  arg.callee.object.name === 'ctx' &&
                  arg.callee.property.name === 'set'
                ) {
                  headers.push({
                    key: arg.arguments[0], // The `key` in `ctx.set(key, value)`
                    value: arg.arguments[1], // The `value` in `ctx.set(key, value)`
                  });
                }
              });
  
              // Step 3: Replace with `HttpResponse.json()`, `HttpResponse.text()`, or `HttpResponse.body()`
              if (jsonArgument) {
                replaceResWithHttpResponse(resCallPath, jsonArgument, 'json', statusNode, headers);
              } else if (bodyArgument) {
                replaceResWithHttpResponse(resCallPath, bodyArgument, 'text', statusNode, headers);
              } else if (statusNode) {
                // If there's no body but we have a status code, use HttpResponse.body("", { status: code })
                replaceResWithHttpResponse(resCallPath, j.literal(''), 'text', statusNode, headers);
              }
            });
        }
      });
  
    // Step 4: Add `import { HttpResponse } from 'msw';` if any transformations were made
    if (hasTransformed) {
      const importDeclarationExists = root.find(j.ImportDeclaration, {
        source: { value: 'msw' }
      }).some(importPath => {
        return importPath.node.specifiers.some(specifier => specifier.imported.name === 'HttpResponse');
      });
  
      if (!importDeclarationExists) {
        // Add the import statement at the top of the file
        const httpResponseImport = j.importDeclaration(
          [j.importSpecifier(j.identifier('HttpResponse'))],
          j.literal('msw')
        );
        root.get().node.program.body.unshift(httpResponseImport);
      }
    }
  
    // Return the modified source code
    return root.toSource();
  };
  