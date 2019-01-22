module.exports = function ConnectionArgFilterPlugin(
  builder,
  {
    connectionFilterAllowedFieldTypes,
    connectionFilterAllowedOperators,
    connectionFilterOperatorNames,
  }
) {
  builder.hook("build", build => {
    const connectionFilterOperatorsByFieldType = {};
    const connectionFilterOperatorsGlobal = {};

    const addConnectionFilterOperator = (
      defaultName,
      description,
      resolveType,
      resolveWhereClause,
      options = {}
    ) => {
      if (!defaultName) {
        throw new Error(
          `Missing argument 'defaultName' in call to 'addConnectionFilterOperator'`
        );
      }
      if (!resolveType) {
        throw new Error(
          `Missing argument 'resolveType' for filter operator '${defaultName}'`
        );
      }
      if (!resolveWhereClause) {
        throw new Error(
          `Missing argument 'resolveWhereClause' for filter operator '${defaultName}'`
        );
      }

      // If `connectionFilterOperatorNames` is specified, override the operator name
      const operatorName =
        (connectionFilterOperatorNames &&
          connectionFilterOperatorNames[defaultName]) ||
        defaultName;

      // If `connectionFilterAllowedOperators` is specified and this operator isn't included, skip it
      if (
        connectionFilterAllowedOperators &&
        !connectionFilterAllowedOperators.includes(operatorName)
      ) {
        return;
      }

      if (connectionFilterOperatorsGlobal[operatorName]) {
        throw new Error(
          `Failed to register filter operator '${operatorName}' because this operator is already registered globally`
        );
      }

      if (options.allowedFieldTypes) {
        // Operator has an `allowedFieldTypes` whitelist
        for (const fieldTypeName of options.allowedFieldTypes) {
          // Ensure operator name hasn't already been registered for this field type
          if (
            connectionFilterOperatorsByFieldType[fieldTypeName] &&
            connectionFilterOperatorsByFieldType[fieldTypeName][operatorName]
          ) {
            throw new Error(
              `Failed to register filter operator '${operatorName}' because this operator is already registered for type '${fieldTypeName}'`
            );
          }

          // Register operator for this field type
          if (!connectionFilterOperatorsByFieldType[fieldTypeName]) {
            connectionFilterOperatorsByFieldType[fieldTypeName] = {};
          }
          connectionFilterOperatorsByFieldType[fieldTypeName][operatorName] = {
            description,
            resolveType,
            resolveWhereClause,
            options,
          };
        }
      } else {
        // Operator does not have an `allowedFieldTypes` whitelist

        // Ensure operator name hasn't been registered for any field type
        Object.entries(connectionFilterOperatorsByFieldType).forEach(
          ([fieldTypeName, operators]) => {
            if (Object.keys(operators).includes(operatorName)) {
              throw new Error(
                `Failed to register global filter operator '${operatorName}' because this operator is already registered for type '${fieldTypeName}'`
              );
            }
          }
        );

        // Register operator globally
        connectionFilterOperatorsGlobal[operatorName] = {
          description,
          resolveType,
          resolveWhereClause,
          options,
        };
      }
    };

    return build.extend(build, {
      addConnectionFilterOperator,
      connectionFilterAllowedFieldTypes,
      connectionFilterOperatorsByFieldType,
      connectionFilterOperatorsGlobal,
    });
  });

  builder.hook("inflection", inflection => {
    return Object.assign(inflection, {
      filterType(typeName) {
        return `${typeName}Filter`;
      },
      filterFieldType(typeName) {
        return `${typeName}Filter`;
      },
      filterFieldListType(typeName) {
        return `${typeName}ListFilter`;
      },
    });
  });
};
