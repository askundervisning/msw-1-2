module.exports = function (fileInfo, api) {
    const j = api.jscodeshift;
    const root = j(fileInfo.source);
  
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
  
    // Handle ArrowFunctionExpression, FunctionExpression, and FunctionDeclaration
    const removeUnusedDestructuredProperties = (functionPath) => {
      const params = functionPath.node.params;
  
      // Iterate over the function's parameters
      params.forEach(param => {
        if (param.type === 'ObjectPattern') {
          // We're dealing with destructured parameters (e.g., { request, params })
          const usedProperties = param.properties.filter(property => {
            // Ensure that only Identifier properties are checked, and they're used in the function body
            if (property.key && property.key.type === 'Identifier') {
              return isDestructuredPropertyUsed(property.key.name, functionPath);
            }
  
            // Keep non-Identifier properties (e.g., spread operators, defaults) intact
            return true;
          });
  
          // Update the ObjectPattern with only used properties
          param.properties = usedProperties;
        }
      });
    };
  
    // Find all functions and apply the transformation to remove unused destructured parameters
    root
      .find(j.FunctionDeclaration)
      .forEach(removeUnusedDestructuredProperties);
  
    root
      .find(j.FunctionExpression)
      .forEach(removeUnusedDestructuredProperties);
  
    root
      .find(j.ArrowFunctionExpression)
      .forEach(removeUnusedDestructuredProperties);
  
    return root.toSource();
  };
  