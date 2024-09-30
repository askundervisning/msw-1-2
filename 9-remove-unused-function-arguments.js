module.exports = function (fileInfo, api) {
    const j = api.jscodeshift;
    const root = j(fileInfo.source);
  
    // A list of HTTP methods to search for
    const httpMethods = ['get', 'post', 'delete', 'put', 'patch'];
  
    // Helper function to check if a call expression is an HTTP method call (e.g., http.get, http.post, etc.)
    const isHttpMethodCall = (node) => {
      return (
        node.callee &&
        node.callee.type === 'MemberExpression' &&
        node.callee.object.name === 'http' &&
        httpMethods.includes(node.callee.property.name)
      );
    };
  
    // Helper function to check if a destructured property is used in the function body
    const isDestructuredPropertyUsed = (propertyName, functionPath) => {
      let isUsed = false;
  
      // Get the function body (skip the parameter list)
      const functionBody = functionPath.node.body;
  
      // Look for usages of the property within the function body
      j(functionBody).find(j.Identifier, { name: propertyName }).forEach(path => {
        // Only count it if it's actually used within the body (not in the destructuring itself)
        const parent = path.parentPath.value;
        if (parent.type !== 'ObjectPattern') {
          isUsed = true;
        }
      });
  
      return isUsed;
    };
  
    // Main logic to remove unused destructured parameters and empty objects
    const removeUnusedDestructuredParams = (path) => {
      const functionPath = path.parentPath; // Get the function in which the http.* call resides
      const args = path.node.arguments; // Get the arguments of the http.* call
  
      args.forEach(arg => {
        if (arg.type === 'ObjectPattern') {
          // We're dealing with destructured parameters (e.g., { request, params })
          const usedProperties = arg.properties.filter(property => {
            // Ensure that only Identifier properties are checked, and they're used in the function body
            if (property.key && property.key.type === 'Identifier') {
              return isDestructuredPropertyUsed(property.key.name, functionPath);
            }
  
            // Keep non-Identifier properties (e.g., spread operators, defaults) intact
            return true;
          });
  
          // Update the ObjectPattern with only used properties
          arg.properties = usedProperties;
  
          // If the object is empty after removing unused properties, remove it from the arguments list
          if (arg.properties.length === 0) {
            // Remove this argument completely
            path.node.arguments = path.node.arguments.filter(a => a !== arg);
          }
        }
      });
    };
  
    // Step 1: Find all CallExpressions that are http.* calls
    root.find(j.CallExpression).forEach(path => {
      if (isHttpMethodCall(path.node)) {
        removeUnusedDestructuredParams(path);
      }
    });
  
    return root.toSource();
  };
  