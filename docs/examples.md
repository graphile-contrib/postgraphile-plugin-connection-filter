## Examples

#### Null values

```graphql
query {
  allPosts(filter: {
    body: { isNull: true }
  }) {
    ...
  }
}
```

#### Non-null values

```graphql
query {
  allPosts(filter: {
    body: { isNull: false }
  }) {
    ...
  }
}
```

#### Comparison operator with scalar input

```graphql
query {
  allPosts(filter: {
    createdAt: { greaterThan: "2021-01-01" }
  }) {
    ...
  }
}
```

#### Comparison operator with array input

```graphql
query {
  allPosts(filter: {
    authorId: { in: [1, 2] }
  }) {
    ...
  }
}
```

#### Multiple comparison operators

> Note: Objects with multiple keys are interpreted with an implicit `AND` between the conditions.

```graphql
query {
  allPosts(filter: {
    body: { isNull: false },
    createdAt: { greaterThan: "2021-01-01" }
  }) {
    ...
  }
}
```

#### Logical operator

```graphql
query {
  allPosts(filter: {
    or: [
      { authorId: { equalTo: 6 } },
      { createdAt: { greaterThan: "2021-01-01" } }
    ]
  }) {
    ...
  }
}
```

#### Compound logic

```graphql
query {
  allPosts(filter: {
    not: {
      or: [
        { authorId: { equalTo: 6 } },
        { createdAt: { greaterThan: "2021-01-01" } }
      ]
    }
  }) {
    ...
  }
}
```

#### Relations: Nested

```graphql
query {
  allPeople(filter: {
    firstName: { startsWith:"John" }
  }) {
    nodes {
      firstName
      lastName
      postsByAuthorId(filter: {
        createdAt: { greaterThan: "2021-01-01" }
      }) {
        nodes {
          ...
        }
      }
    }
  }
}
```

#### Relations: Root-level, many-to-one

> Requires `connectionFilterRelations: true`

```graphql
query {
  allPosts(filter: {
    personByAuthorId: { createdAt: { greaterThan: "2021-01-01" } }
  }) {
    ...
  }
}
```

A node passes the filter if a related node exists _and_ the filter criteria for the related node are satisfied. (If a related node does not exist, the check fails.)

The `*Exists` Boolean field can be used to filter on the existence of a related node:

```graphql
query {
  allPosts(filter: { personByAuthorIdExists: true }) {
    nodes {
      id
    }
  }
}
```

The `*Exists` Boolean field is only exposed on nullable relations. For example, if the `post.author_id` column is defined as `not null`, a related `person` always exists, so the `personByAuthorIdExists` field is not exposed.

#### Relations: Root-level, one-to-one

> Requires `connectionFilterRelations: true`

```graphql
query {
  allPeople(filter: {
    accountByAccountId: { status: { equalTo: ACTIVE } }
  }) {
    ...
  }
}
```

A node passes the filter if a related node exists _and_ the filter criteria for the related node are satisfied. (If a related node does not exist, the check fails.)

The `*Exists` Boolean field can be used to filter on the existence of a related node:

```graphql
query {
  allPeople(filter: { accountByAccountId: true }) {
    nodes {
      id
    }
  }
}
```

The `*Exists` Boolean field is only exposed on nullable relations. For example, if the `person.account_id` column is defined as `not null`, a related `account` always exists, so the `accountByAccountIdExists` field is not exposed.

#### Relations: Root-level, one-to-many

> Requires `connectionFilterRelations: true`

One-to-many relation fields require the filter criteria to be nested under `every`, `some`, or `none`.

```graphql
query {
  allPeople(
    filter: { postsByAuthorId: { some: { status: { equalTo: PUBLISHED } } } }
  ) {
    nodes {
      id
    }
  }
}
```

The `*Exist` Boolean field can be used to filter on the existence of related records:

```graphql
query {
  allPeople(filter: { postsByAuthorIdExist: true }) {
    nodes {
      id
    }
  }
}
```

For additional examples, see the [tests](https://github.com/graphile-contrib/postgraphile-plugin-connection-filter/blob/master/__tests__/fixtures/queries/).
