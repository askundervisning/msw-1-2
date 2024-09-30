/**
 * Prompt:
 * Thank you. Now each of the handler functions might have defined generics like this:

const handlers = http.post<{
    playlistItems: {
      id?: number
      resource: number
      score: number
      origin: OriginLink
    }[]
  }>(...)

If the function call is http.post or http.patch or http.delete, then the generics should be rewritten from the above to add a PathParamss before the original generic object like this:

const handlers = http.post<PathParam, {
    playlistItems: {
      id?: number
      resource: number
      score: number
      origin: OriginLink
    }[]
  }>(...)

Write a JScodemod that goes through the handlers in a file and fixes this
*/
module.exports = function (fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  // A list of http methods that need to be modified
  const httpMethods = ["post", "patch", "delete"];

  // Helper function to check if the CallExpression is an http method we care about
  const isHttpMethodCall = (call) => {
    return (
      call.callee.type === "MemberExpression" &&
      call.callee.object.name === "http" &&
      httpMethods.includes(call.callee.property.name)
    );
  };

  // Find all function calls that match http.post, http.patch, or http.delete
  root
    .find(j.CallExpression)
    .filter((path) => isHttpMethodCall(path.node))
    .forEach((path) => {
      const callExpression = path.node;

      // Check if there are generics specified
      if (
        callExpression.typeParameters &&
        callExpression.typeParameters.params.length > 0
      ) {
        const firstGenericType = callExpression.typeParameters.params[0];

        // Check if PathParams is already present
        const alreadyHasPathParams =
          firstGenericType.type === "TSTypeReference" &&
          firstGenericType.typeName.name === "PathParams";

        if (!alreadyHasPathParams) {
          // Add PathParams as the first generic parameter
          const newGenericParams = [
            j.tsTypeReference(j.identifier("PathParams")),
            ...callExpression.typeParameters.params,
          ];

          console.log(newGenericParams);

          // Replace the original generics with the new one
          callExpression.typeParameters.params = newGenericParams;
        }
      }
    });

  return root.toSource();
};
