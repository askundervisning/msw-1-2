/*
Good, now update the jscodemod so that calls to req.url.searchParams are replaced by adding 

const url = new URL(request.url)
And then changing the callsite to :
url.searchParams
*/
module.exports = function (fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  // A list of http methods that need to be modified (expand as needed)
  const httpMethods = ['post', 'patch', 'delete', 'get', 'put'];

  // Helper function to check if the CallExpression is an http method we care about
  const isHttpMethodCall = (call) => {
    return call.callee.type === 'MemberExpression' &&
      call.callee.object.name === 'http' &&
      httpMethods.includes(call.callee.property.name);
  };

  // Step 1: Find all function calls that match http.post, http.patch, http.delete, etc.
  root
    .find(j.CallExpression)
    .filter(path => isHttpMethodCall(path.node))
    .forEach(path => {
      const handlerFunction = path.node.arguments[1];
      
      // Step 2: Check if the second argument is a function with the old (req, res, ctx) signature
      if (
        handlerFunction &&
        handlerFunction.type === 'ArrowFunctionExpression' &&
        handlerFunction.params.length === 3 &&
        handlerFunction.params[0].name === 'req' &&
        handlerFunction.params[1].name === 'res' &&
        handlerFunction.params[2].name === 'ctx'
      ) {
        // Step 3: Replace (req, res, ctx) with ({ request, params })
        handlerFunction.params = [
          j.objectPattern([
            j.property('init', j.identifier('request'), j.identifier('request')),
            j.property('init', j.identifier('params'), j.identifier('params'))
          ])
        ];

        // Step 4: Replace `req.params` with `params` in the function body
        j(handlerFunction.body)
          .find(j.MemberExpression, {
            object: { name: 'req' },
            property: { name: 'params' }
          })
          .replaceWith(j.identifier('params'));

        // Step 5: Replace `req.url.searchParams` with `url.searchParams`
        const reqUrlSearchParams = j(handlerFunction.body)
          .find(j.MemberExpression, {
            object: {
              type: 'MemberExpression',
              object: { name: 'req' },
              property: { name: 'url' }
            },
            property: { name: 'searchParams' }
          });

        if (reqUrlSearchParams.size() > 0) {
          // Step 6: Check if `const url = new URL(request.url)` is already present
          const urlDeclarationExists = j(handlerFunction.body)
            .find(j.VariableDeclarator, {
              id: { name: 'url' },
              init: {
                type: 'NewExpression',
                callee: { name: 'URL' },
                arguments: [{ type: 'MemberExpression', object: { name: 'request' }, property: { name: 'url' } }]
              }
            })
            .size() > 0;

          if (!urlDeclarationExists) {
            // Insert `const url = new URL(request.url)` at the start of the function body if it doesn't exist
            const urlDeclaration = j.variableDeclaration('const', [
              j.variableDeclarator(
                j.identifier('url'),
                j.newExpression(j.identifier('URL'), [
                  j.memberExpression(j.identifier('request'), j.identifier('url'))
                ])
              )
            ]);

            handlerFunction.body.body.unshift(urlDeclaration);
          }

          // Replace `req.url.searchParams` with `url.searchParams`
          reqUrlSearchParams.replaceWith(
            j.memberExpression(j.identifier('url'), j.identifier('searchParams'))
          );
        }
      }
    });

  return root.toSource();
};
