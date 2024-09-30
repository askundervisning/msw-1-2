/*
OK, now I need to operate on the same functions as above, but I'll start by looking at ctx() statements. Now I want to replace these statements with a new Result() where the content of the result depends as following:

*/

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
        }
      })
      
      .map(path => {
        console.log(path.node.typeAnnotation,"node"

          
        )
        return path

      })
      .filter(path => path.node.typeAnnotation?.typeAnnotation?.typeName?.name === 'FormData')
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
        const typeParameters = mainCall.typeParameters;
        

        // Step 3: Check if the second type parameter is FormData or req.body is cast to FormData
        const hasFormDataType = hasSecondTypeParameterAsFormData(typeParameters);
        const bodyCastedToFormData = isReqBodyCastToFormData(handlerFunction.body);
        const bodyGetCalls = hasReqBodyGetCall(handlerFunction.body);
        const bodyAsFormDataCast = hasReqBodyAsFormDataCast(handlerFunction.body);

        if (hasFormDataType || bodyCastedToFormData || bodyGetCalls || bodyAsFormDataCast) {
          // Step 3: Search for req.body references in the function body
          let bodyReferences = j(handlerFunction.body)
            .find(j.MemberExpression, {
              object: { name: 'req' },
              property: { name: 'body' }
            });

          if (bodyReferences.size() > 0) {
            // Step 4: Ensure formDataBody is declared only once
            const formDataBodyExists = j(handlerFunction.body)
              .find(j.VariableDeclarator, { id: { name: 'formDataBody' } })
              .size() > 0;

            if (!formDataBodyExists) {
              // Insert `const formDataBody = await request.formData()` at the start of the function body
              const formDataDeclaration = j.variableDeclaration('const', [
                j.variableDeclarator(
                  j.identifier('formDataBody'),
                  j.awaitExpression(
                    j.callExpression(
                      j.memberExpression(j.identifier('request'), j.identifier('formData')),
                      []
                    )
                  )
                )
              ]);

              handlerFunction.body.body.unshift(formDataDeclaration);
            }

            // Step 5: Replace all `req.body` references with `formDataBody`
            bodyReferences.replaceWith(j.identifier('formDataBody'));
          }
        }
      }
    });

  // Return the modified source code
  return root.toSource();
};
