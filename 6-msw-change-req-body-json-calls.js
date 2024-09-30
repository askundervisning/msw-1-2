module.exports = function (fileInfo, api) {
    const j = api.jscodeshift;
    const root = j(fileInfo.source);
  
    // A list of HTTP methods that need to be modified
    const httpMethods = ['post', 'patch', 'put', 'get', 'delete'];
  
    // Step 1: Find all http method handlers (post, put, get, etc.)
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
      });
  
    // Return the modified source code
    return root.toSource();
  };
  