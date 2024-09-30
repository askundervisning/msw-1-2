module.exports = function (fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  // A list of http methods that need to be modified
  const httpMethods = ['post', 'patch', 'put', 'get', 'delete'];

  // Helper function to check if the second type parameter is FormData
  const hasSecondTypeParameterAsFormData = (typeParameters) => {

    if (typeParameters && typeParameters.params.length >= 2) {
      const secondTypeParam = typeParameters.params[1];
      return secondTypeParam.typeName && secondTypeParam.typeName.name === 'FormData';
    }
    return false;
  };

  // Helper function to check if req.body is cast to FormData in the function body
  const isReqBodyCastToFormData = (functionBody) => {
    return j(functionBody)
      .find(j.TSAsExpression, {
        expression: {
          type: 'MemberExpression',
          object: { name: 'req' },
          property: { name: 'body' }
        },
        typeAnnotation: {
          typeAnnotation: { typeName: { name: 'FormData' } }
        }
      })
      .size() > 0;
  };


  // Helper function to check if there are calls to `req.body.get`
  const hasReqBodyGetCall = (functionBody) => {
    return j(functionBody)
      .find(j.MemberExpression, {
        object: {
          type: 'MemberExpression',
          object: { name: 'req' },
          property: { name: 'body' }
        },
        property: { name: 'get' }
      })
      .size() > 0;
  };

    // Helper function to check if `req.body` is cast using "as FormData"
    const hasReqBodyAsFormDataCast = (functionBody) => {
      return j(functionBody)
        .find(j.TSAsExpression, {
          expression: {
            type: 'MemberExpression',
            object: { name: 'req' },
            property: { name: 'body' }
          },
          typeAnnotation: {
            typeAnnotation: { typeName: { name: 'FormData' } }
          }
        })
        .size() > 0;
    };
  
  // Step 1: Find all http methods (post, put, get, etc.)
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
      const mainCall = path.node;

      if (handlerFunction && handlerFunction.type === 'ArrowFunctionExpression') {
        if (!handlerFunction.async) {
          handlerFunction.async = true;
        }
      } else {
        console.log('Handler function is not an ArrowFunctionExpression', handlerFunction.type);
      }
    });

  // Return the modified source code
  return root.toSource();
};
