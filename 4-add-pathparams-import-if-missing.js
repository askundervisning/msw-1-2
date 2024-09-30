module.exports = function (fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  let hasPathParamsType = false;

  // Step 1: Check if any function uses PathParams in typeParameters

  root.find(j.CallExpression).forEach((path) => {
    const typeParameters = path.node.typeParameters;
    if (
      typeParameters &&
      typeParameters.params.some(
        (param) => param.typeName && param.typeName.name === "PathParams"
      )
    ) {
      hasPathParamsType = true;
    }
  });
  console.log(hasPathParamsType);

  // Step 2: Check if 'PathParams' is imported from 'msw'
  const mswImport = root.find(j.ImportDeclaration, {
    source: { value: "msw" },
  });
  let pathParamsAlreadyImported = false;

  mswImport.forEach((path) => {
    path.node.specifiers.forEach((specifier) => {
      if (specifier.imported && specifier.imported.name === "PathParams") {
        pathParamsAlreadyImported = true;
      }
    });
  });

  // Step 3: If PathParams is used but not imported, add it to the import from 'msw'
  if (hasPathParamsType && !pathParamsAlreadyImported) {
    if (mswImport.size() > 0) {
      // Add PathParams to existing import
      mswImport.forEach((path) => {
        path.node.specifiers.push(
          j.importSpecifier(j.identifier("PathParams"))
        );
      });
    } else {
      // Create a new import for msw with PathParams
      const newImport = j.importDeclaration(
        [j.importSpecifier(j.identifier("PathParams"))],
        j.literal("msw")
      );
      root.get().node.program.body.unshift(newImport);
    }
  }

  return root.toSource();
};
