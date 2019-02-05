module.exports = function PgConnectionArgFilterOperatorsPlugin(
  builder,
  { connectionFilterAllowedOperators, connectionFilterOperatorNames }
) {
  builder.hook("GraphQLInputObjectType:fields", (fields, build, context) => {
    const {
      extend,
      graphql: {
        getNamedType,
        GraphQLBoolean,
        GraphQLString,
        GraphQLNonNull,
        GraphQLList,
      },
      pgGetGqlInputTypeByTypeIdAndModifier,
      pgIntrospectionResultsByKind: introspectionResultsByKind,
      pgSql: sql,
      gql2pg,
      connectionFilterDeprecatedOperatorSpecsAdded,
      connectionFilterRegisterResolver,
      connectionFilterTypesByTypeName,
      escapeLikeWildcards,
    } = build;
    const {
      scope: { isPgConnectionFilterOperators, pgType, pgTypeModifier },
      fieldWithHooks,
      Self,
    } = context;
    if (!isPgConnectionFilterOperators || !pgType) {
      return fields;
    }

    connectionFilterTypesByTypeName[Self.name] = Self;

    const fieldInputType = pgGetGqlInputTypeByTypeIdAndModifier(
      pgType.id,
      pgTypeModifier
    );
    if (!fieldInputType) {
      return fields;
    }

    const standardOperators = {
      isNull: {
        description:
          "Is null (if `true` is specified) or is not null (if `false` is specified).",
        resolveType: () => GraphQLBoolean,
        resolveSqlValue: () => null, // do not parse
        resolve: (i, _v, input) =>
          sql.query`${i} ${
            input ? sql.query`IS NULL` : sql.query`IS NOT NULL`
          }`,
      },
      equalTo: {
        description: "Equal to the specified value.",
        resolve: (i, v) => sql.query`${i} = ${v}`,
      },
      notEqualTo: {
        description: "Not equal to the specified value.",
        resolve: (i, v) => sql.query`${i} <> ${v}`,
      },
      distinctFrom: {
        description:
          "Not equal to the specified value, treating null like an ordinary value.",
        resolve: (i, v) => sql.query`${i} IS DISTINCT FROM ${v}`,
      },
      notDistinctFrom: {
        description:
          "Equal to the specified value, treating null like an ordinary value.",
        resolve: (i, v) => sql.query`${i} IS NOT DISTINCT FROM ${v}`,
      },
      in: {
        description: "Included in the specified list.",
        resolveType: fieldInputType =>
          new GraphQLList(new GraphQLNonNull(fieldInputType)),
        resolve: (i, v) => sql.query`${i} IN ${v}`,
      },
      notIn: {
        description: "Not included in the specified list.",
        resolveType: fieldInputType =>
          new GraphQLList(new GraphQLNonNull(fieldInputType)),
        resolve: (i, v) => sql.query`${i} NOT IN ${v}`,
      },
    };
    const sortOperators = {
      lessThan: {
        description: "Less than the specified value.",
        resolve: (i, v) => sql.query`${i} < ${v}`,
      },
      lessThanOrEqualTo: {
        description: "Less than or equal to the specified value.",
        resolve: (i, v) => sql.query`${i} <= ${v}`,
      },
      greaterThan: {
        description: "Greater than the specified value.",
        resolve: (i, v) => sql.query`${i} > ${v}`,
      },
      greaterThanOrEqualTo: {
        description: "Greater than or equal to the specified value.",
        resolve: (i, v) => sql.query`${i} >= ${v}`,
      },
    };
    const patternMatchingOperators = {
      includes: {
        description: "Contains the specified string (case-sensitive).",
        resolveInput: input => `%${escapeLikeWildcards(input)}%`,
        resolve: (i, v) => sql.query`${i} LIKE ${v}`,
      },
      notIncludes: {
        description: "Does not contain the specified string (case-sensitive).",
        resolveInput: input => `%${escapeLikeWildcards(input)}%`,
        resolve: (i, v) => sql.query`${i} NOT LIKE ${v}`,
      },
      includesInsensitive: {
        description: "Contains the specified string (case-insensitive).",
        resolveInput: input => `%${escapeLikeWildcards(input)}%`,
        resolve: (i, v) => sql.query`${i} ILIKE ${v}`,
      },
      notIncludesInsensitive: {
        description:
          "Does not contain the specified string (case-insensitive).",
        resolveInput: input => `%${escapeLikeWildcards(input)}%`,
        resolve: (i, v) => sql.query`${i} NOT ILIKE ${v}`,
      },
      startsWith: {
        description: "Starts with the specified string (case-sensitive).",
        resolveInput: input => `${escapeLikeWildcards(input)}%`,
        resolve: (i, v) => sql.query`${i} LIKE ${v}`,
      },
      notStartsWith: {
        description:
          "Does not start with the specified string (case-sensitive).",
        resolveInput: input => `${escapeLikeWildcards(input)}%`,
        resolve: (i, v) => sql.query`${i} NOT LIKE ${v}`,
      },
      startsWithInsensitive: {
        description: "Starts with the specified string (case-insensitive).",
        resolveInput: input => `${escapeLikeWildcards(input)}%`,
        resolve: (i, v) => sql.query`${i} ILIKE ${v}`,
      },
      notStartsWithInsensitive: {
        description:
          "Does not start with the specified string (case-insensitive).",
        resolveInput: input => `${escapeLikeWildcards(input)}%`,
        resolve: (i, v) => sql.query`${i} NOT ILIKE ${v}`,
      },
      endsWith: {
        description: "Ends with the specified string (case-sensitive).",
        resolveInput: input => `%${escapeLikeWildcards(input)}`,
        resolve: (i, v) => sql.query`${i} LIKE ${v}`,
      },
      notEndsWith: {
        description: "Does not end with the specified string (case-sensitive).",
        resolveInput: input => `%${escapeLikeWildcards(input)}`,
        resolve: (i, v) => sql.query`${i} NOT LIKE ${v}`,
      },
      endsWithInsensitive: {
        description: "Ends with the specified string (case-insensitive).",
        resolveInput: input => `%${escapeLikeWildcards(input)}`,
        resolve: (i, v) => sql.query`${i} ILIKE ${v}`,
      },
      notEndsWithInsensitive: {
        description:
          "Does not end with the specified string (case-insensitive).",
        resolveInput: input => `%${escapeLikeWildcards(input)}`,
        resolve: (i, v) => sql.query`${i} NOT ILIKE ${v}`,
      },
      like: {
        description:
          "Matches the specified pattern (case-sensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.",
        resolve: (i, v) => sql.query`${i} LIKE ${v}`,
      },
      notLike: {
        description:
          "Does not match the specified pattern (case-sensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.",
        resolve: (i, v) => sql.query`${i} NOT LIKE ${v}`,
      },
      likeInsensitive: {
        description:
          "Matches the specified pattern (case-insensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.",
        resolve: (i, v) => sql.query`${i} ILIKE ${v}`,
      },
      notLikeInsensitive: {
        description:
          "Does not match the specified pattern (case-insensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.",
        resolve: (i, v) => sql.query`${i} NOT ILIKE ${v}`,
      },
      similarTo: {
        description:
          "Matches the specified pattern using the SQL standard's definition of a regular expression.",
        resolve: (i, v) => sql.query`${i} SIMILAR TO ${v}`,
      },
      notSimilarTo: {
        description:
          "Does not match the specified pattern using the SQL standard's definition of a regular expression.",
        resolve: (i, v) => sql.query`${i} NOT SIMILAR TO ${v}`,
      },
      // TODO: add regexp operators
    };
    const hstoreOperators = {
      contains: {
        description: "Contains the specified KeyValueHash.",
        resolve: (i, v) => sql.query`${i} @> ${v}`,
      },
      containsKey: {
        description: "Contains the specified key.",
        resolveType: () => GraphQLString,
        resolveSqlValue: input => sql.query`${sql.value(input)}::text`,
        resolve: (i, v) => sql.query`${i} ? ${v}`,
      },
      containsAllKeys: {
        name: "containsAllKeys",
        description: "Contains all of the specified keys.",
        resolveType: () => new GraphQLList(new GraphQLNonNull(GraphQLString)),
        resolveSqlValue: input => sql.value(input),
        resolve: (i, v) => sql.query`${i} ?& ${v}`,
      },
      containsAnyKeys: {
        name: "containsAnyKeys",
        description: "Contains any of the specified keys.",
        resolveType: () => new GraphQLList(new GraphQLNonNull(GraphQLString)),
        resolveSqlValue: input => sql.value(input),
        resolve: (i, v) => sql.query`${i} ?| ${v}`,
      },
      containedBy: {
        description: "Contained by the specified KeyValueHash.",
        resolve: (i, v) => sql.query`${i} <@ ${v}`,
      },
    };
    const jsonbOperators = {
      contains: {
        description: "Contains the specified JSON.",
        resolve: (i, v) => sql.query`${i} @> ${v}`,
      },
      /*
      containsKey: {
        description: "Contains the specified key.",
        resolveType: () => GraphQLString,
        resolveSqlValue: input => sql.query`${sql.value(input)}::text`,
        resolve: (i, v) => sql.query`${i} ? ${v}`,
      },
      containsAllKeys: {
        name: "containsAllKeys",
        description: "Contains all of the specified keys.",
        resolveType: () => new GraphQLList(new GraphQLNonNull(GraphQLString)),
        resolveSqlValue: input => sql.value(input),
        resolve: (i, v) => sql.query`${i} ?& ${v}`,
      },
      containsAnyKeys: {
        name: "containsAnyKeys",
        description: "Contains any of the specified keys.",
        resolveType: () => new GraphQLList(new GraphQLNonNull(GraphQLString)),
        resolveSqlValue: input => sql.value(input),
        resolve: (i, v) => sql.query`${i} ?| ${v}`,
      },
      */
      containedBy: {
        description: "Contained by the specified JSON.",
        resolve: (i, v) => sql.query`${i} <@ ${v}`,
      },
    };
    const inetOperators = {
      contains: {
        description: "Contains the specified internet address.",
        resolve: (i, v) => sql.query`${i} >> ${v}`,
      },
      containsOrEqualTo: {
        description: "Contains or equal to the specified internet address.",
        resolve: (i, v) => sql.query`${i} >>= ${v}`,
      },
      containedBy: {
        description: "Contained by the specified internet address.",
        resolve: (i, v) => sql.query`${i} << ${v}`,
      },
      containedByOrEqualTo: {
        description: "Contained by or equal to the specified internet address.",
        resolve: (i, v) => sql.query`${i} <<= ${v}`,
      },
      containsOrContainedBy: {
        description: "Contains or contained by the specified internet address.",
        resolve: (i, v) => sql.query`${i} && ${v}`,
      },
    };
    const operatorSpecsByPgTypeName = {
      bit: { ...standardOperators, ...sortOperators },
      bool: { ...standardOperators, ...sortOperators },
      bpchar: {
        ...standardOperators,
        ...sortOperators,
        ...patternMatchingOperators,
      },
      char: {
        ...standardOperators,
        ...sortOperators,
        ...patternMatchingOperators,
      },
      date: { ...standardOperators, ...sortOperators },
      float4: { ...standardOperators, ...sortOperators },
      float8: { ...standardOperators, ...sortOperators },
      hstore: {
        ...standardOperators,
        ...hstoreOperators,
      },
      inet: {
        ...standardOperators,
        ...sortOperators,
        ...inetOperators,
      },
      int2: { ...standardOperators, ...sortOperators },
      int4: { ...standardOperators, ...sortOperators },
      int8: { ...standardOperators, ...sortOperators },
      interval: { ...standardOperators, ...sortOperators },
      jsonb: {
        ...standardOperators,
        ...sortOperators,
        ...jsonbOperators,
      },
      macaddr: { ...standardOperators, ...sortOperators },
      macaddr8: { ...standardOperators, ...sortOperators },
      money: { ...standardOperators, ...sortOperators },
      numeric: { ...standardOperators, ...sortOperators },
      text: {
        ...standardOperators,
        ...sortOperators,
        ...patternMatchingOperators,
      },
      time: { ...standardOperators, ...sortOperators },
      timestamp: { ...standardOperators, ...sortOperators },
      timestamptz: { ...standardOperators, ...sortOperators },
      timetz: { ...standardOperators, ...sortOperators },
      uuid: { ...standardOperators, ...sortOperators },
      varbit: { ...standardOperators, ...sortOperators },
      varchar: {
        ...standardOperators,
        ...sortOperators,
        ...patternMatchingOperators,
      },
    };
    const enumOperators = { ...standardOperators, ...sortOperators };
    const arrayOperators = {
      isNull: standardOperators.isNull,
      equalTo: standardOperators.equalTo,
      notEqualTo: standardOperators.notEqualTo,
      distinctFrom: standardOperators.distinctFrom,
      notDistinctFrom: standardOperators.notDistinctFrom,
      ...sortOperators,
      contains: {
        description: "Contains the specified list of values.",
        resolve: (i, v) => sql.query`${i} @> ${v}`,
      },
      containedBy: {
        description: "Contained by the specified list of values.",
        resolve: (i, v) => sql.query`${i} <@ ${v}`,
      },
      overlaps: {
        description: "Overlaps the specified list of values.",
        resolve: (i, v) => sql.query`${i} && ${v}`,
      },
      anyEqualTo: {
        description: "Any array item is equal to the specified value.",
        resolveType: fieldInputType => getNamedType(fieldInputType),
        resolve: (i, v) => sql.query`${v} = ANY (${i})`,
      },
      anyNotEqualTo: {
        description: "Any array item is not equal to the specified value.",
        resolveType: fieldInputType => getNamedType(fieldInputType),
        resolve: (i, v) => sql.query`${v} <> ANY (${i})`,
      },
      anyLessThan: {
        description: "Any array item is less than the specified value.",
        resolveType: fieldInputType => getNamedType(fieldInputType),
        resolve: (i, v) => sql.query`${v} > ANY (${i})`,
      },
      anyLessThanOrEqualTo: {
        description:
          "Any array item is less than or equal to the specified value.",
        resolveType: fieldInputType => getNamedType(fieldInputType),
        resolve: (i, v) => sql.query`${v} >= ANY (${i})`,
      },
      anyGreaterThan: {
        description: "Any array item is greater than the specified value.",
        resolveType: fieldInputType => getNamedType(fieldInputType),
        resolve: (i, v) => sql.query`${v} < ANY (${i})`,
      },
      anyGreaterThanOrEqualTo: {
        description:
          "Any array item is greater than or equal to the specified value.",
        resolveType: fieldInputType => getNamedType(fieldInputType),
        resolve: (i, v) => sql.query`${v} <= ANY (${i})`,
      },
    };
    const rangeOperators = {
      ...standardOperators,
      ...sortOperators,
      contains: {
        description: "Contains the specified range.",
        resolve: (i, v) => sql.query`${i} @> ${v}`,
      },
      containsElement: {
        description: "Contains the specified value.",
        resolveType: () =>
          pgGetGqlInputTypeByTypeIdAndModifier(
            pgType.rangeSubTypeId,
            pgTypeModifier
          ),
        resolveSqlValue: (input, pgType, pgTypeModifier) => {
          const rangeSubType =
            introspectionResultsByKind.typeById[pgType.rangeSubTypeId];
          return sql.query`${gql2pg(
            input,
            pgType.rangeSubTypeId,
            pgTypeModifier
          )}::${sql.identifier(rangeSubType.namespaceName, rangeSubType.name)}`;
        },
        resolve: (i, v) => sql.query`${i} @> ${v}`,
      },
      containedBy: {
        description: "Contained by the specified range.",
        resolve: (i, v) => sql.query`${i} <@ ${v}`,
      },
      overlaps: {
        description: "Overlaps the specified range.",
        resolve: (i, v) => sql.query`${i} && ${v}`,
      },
      strictlyLeftOf: {
        description: "Strictly left of the specified range.",
        resolve: (i, v) => sql.query`${i} << ${v}`,
      },
      strictlyRightOf: {
        description: "Strictly right of the specified range.",
        resolve: (i, v) => sql.query`${i} >> ${v}`,
      },
      notExtendsRightOf: {
        description: "Does not extend right of the specified range.",
        resolve: (i, v) => sql.query`${i} &< ${v}`,
      },
      notExtendsLeftOf: {
        description: "Does not extend left of the specified range.",
        resolve: (i, v) => sql.query`${i} &> ${v}`,
      },
      adjacentTo: {
        description: "Adjacent to the specified range.",
        resolve: (i, v) => sql.query`${i} -|- ${v}`,
      },
    };

    for (const deprecatedOperatorSpec of connectionFilterDeprecatedOperatorSpecsAdded) {
      const {
        name,
        description,
        allowedFieldTypes,
        allowedListTypes,
        resolveType,
        resolve,
      } = deprecatedOperatorSpec;
      if (allowedListTypes.includes("List")) {
        if (arrayOperators[name]) {
          throw new Error(`Array operator '${name}' already exists.`);
        }
        arrayOperators[name] = {
          description,
          resolveType,
          resolve,
        };
      }
      if (
        allowedListTypes.includes["NonList"] &&
        allowedFieldTypes.includes(fieldInputType.name)
      ) {
        if (
          operatorSpecsByPgTypeName[pgType.name] &&
          operatorSpecsByPgTypeName[pgType.name][name]
        ) {
          throw new Error(
            `${fieldInputType.name} operator '${name}' already exists.`
          );
        }
        if (!operatorSpecsByPgTypeName[pgType.name]) {
          operatorSpecsByPgTypeName[pgType.name] = {};
        }
        operatorSpecsByPgTypeName[pgType.name][name] = {
          description,
          resolveType,
          resolve,
        };
      }
    }

    const operatorSpecs = pgType.isPgArray
      ? arrayOperators
      : pgType.rangeSubTypeId
      ? rangeOperators
      : pgType.type === "e"
      ? enumOperators
      : operatorSpecsByPgTypeName[pgType.name];
    if (!operatorSpecs) {
      return fields;
    }

    const operatorSpecByFieldName = {};

    const operatorFields = Object.entries(operatorSpecs).reduce(
      (memo, [name, spec]) => {
        const { description, resolveType } = spec;

        if (
          connectionFilterAllowedOperators &&
          !connectionFilterAllowedOperators.includes(name)
        ) {
          return memo;
        }
        const type = resolveType ? resolveType(fieldInputType) : fieldInputType;

        const operatorName =
          (connectionFilterOperatorNames &&
            connectionFilterOperatorNames[name]) ||
          name;

        operatorSpecByFieldName[operatorName] = spec;

        memo[operatorName] = fieldWithHooks(
          operatorName,
          {
            description,
            type,
          },
          {
            isPgConnectionFilterOperator: true,
          }
        );
        return memo;
      },
      {}
    );

    const resolve = ({
      sourceAlias,
      fieldName,
      fieldValue,
      queryBuilder,
      pgType,
      pgTypeModifier,
      parentFieldName,
    }) => {
      if (fieldValue == null) return null;

      const sqlIdentifier = sourceAlias;

      const operatorSpec = operatorSpecByFieldName[fieldName];
      const { resolveInput, resolveSqlValue } = operatorSpec;

      const input = fieldValue;

      const sqlValueFromInput = (input, pgType, pgTypeModifier) => {
        return gql2pg(
          resolveInput ? resolveInput(input) : input,
          pgType,
          pgTypeModifier
        );
      };

      const sqlValue = resolveSqlValue
        ? resolveSqlValue(input, pgType, pgTypeModifier)
        : Array.isArray(input)
        ? pgType.isPgArray
          ? sqlValueFromInput(input, pgType, pgTypeModifier)
          : input.length === 0
          ? sql.query`(select ${sqlIdentifier} limit 0)`
          : sql.query`(${sql.join(
              input.map(i => sqlValueFromInput(i, pgType, pgTypeModifier)),
              ","
            )})`
        : pgType.isPgArray
        ? sqlValueFromInput(input, pgType.arrayItemType, pgTypeModifier)
        : sqlValueFromInput(input, pgType, pgTypeModifier);

      return operatorSpec.resolve(
        sqlIdentifier,
        sqlValue,
        input,
        parentFieldName,
        queryBuilder
      );
    };

    for (const fieldName of Object.keys(operatorFields)) {
      connectionFilterRegisterResolver(Self.name, fieldName, resolve);
    }

    return extend(fields, operatorFields);
  });
};
