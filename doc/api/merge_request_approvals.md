---
stage: Create
group: Code Review
info: To determine the technical writer assigned to the Stage/Group associated with this page, see https://handbook.gitlab.com/handbook/product/ux/technical-writing/#assignments
description: Documentation for the REST API for merge request approvals in GitLab.
title: Merge request approvals API
---

{{< details >}}

- Tier: Premium, Ultimate
- Offering: GitLab.com, GitLab Self-Managed, GitLab Dedicated

{{< /details >}}

{{< history >}}

- Endpoint `/approvals` [removed](https://gitlab.com/gitlab-org/gitlab/-/issues/353097) in GitLab 16.0.

{{< /history >}}

This API manages the configuration for approvals on merge requests in your project or group:

- Approve and unapprove a merge request as a user.
- Reset all approvals, not just your own, on a merge request.
- View and manage approval rules for a project.

All endpoints require authentication.

## Approve merge request

Users with the appropriate role can approve a merge request using this endpoint:

```plaintext
POST /projects/:id/merge_requests/:merge_request_iid/approve
```

Supported attributes:

| Attribute           | Type              | Required | Description |
|---------------------|-------------------|----------|-------------|
| `id`                | integer or string | Yes      | The ID or [URL-encoded path of a project](rest/_index.md#namespaced-paths). |
| `approval_password` | string            | No       | Current user's password. Required if [**Require user re-authentication to approve**](../user/project/merge_requests/approvals/settings.md#require-user-re-authentication-to-approve) is enabled in the project settings. Always fails if the group or GitLab Self-Managed instance is configured to force SAML authentication. |
| `merge_request_iid` | integer           | Yes      | The IID of the merge request. |
| `sha`               | string            | No       | The `HEAD` of the merge request. |

The `sha` parameter works in the same way as
when [accepting a merge request](merge_requests.md#merge-a-merge-request): if passed, then it must
match the current HEAD of the merge request to add the approval. If it
does not match, the response code is `409`.

```json
{
  "id": 5,
  "iid": 5,
  "project_id": 1,
  "title": "Approvals API",
  "description": "Test",
  "state": "opened",
  "created_at": "2016-06-08T00:19:52.638Z",
  "updated_at": "2016-06-09T21:32:14.105Z",
  "merge_status": "can_be_merged",
  "approvals_required": 2,
  "approvals_left": 0,
  "approved_by": [
    {
      "user": {
        "name": "Administrator",
        "username": "root",
        "id": 1,
        "state": "active",
        "avatar_url": "http://www.gravatar.com/avatar/e64c7d89f26bd1972efa854d13d7dd61?s=80\u0026d=identicon",
        "web_url": "http://localhost:3000/root"
      }
    },
    {
      "user": {
        "name": "Nico Cartwright",
        "username": "ryley",
        "id": 2,
        "state": "active",
        "avatar_url": "http://www.gravatar.com/avatar/cf7ad14b34162a76d593e3affca2adca?s=80\u0026d=identicon",
        "web_url": "http://localhost:3000/ryley"
      }
    }
  ]
}
```

### Approvals for automated merge requests

If you use the API to create and immediately approve a merge request, your automation
might approve the merge request before the commit is fully processed. By default, adding
a new commit to a merge request
[resets any existing approvals](../user/project/merge_requests/approvals/settings.md#remove-all-approvals-when-commits-are-added-to-the-source-branch).
When this happens, the **Activity** area of the merge request shows a sequence of
messages like this:

- `(botname)` approved this merge request 5 minutes ago
- `(botname)` added 1 commit 5 minutes ago
- `(botname)` reset approvals from `(botname)` by pushing to the branch 5 minutes ago

To ensure automated approvals are not applied before commit processing is complete,
your automation should add a wait (or `sleep`) function until:

- The `detailed_merge_status` attribute is not in either the `checking` or `approvals_syncing` states.
- The merge request diff contains a `patch_id_sha` that is not NULL.

## Unapprove merge request

If you did approve a merge request, and now want to unapprove it, use this endpoint:

```plaintext
POST /projects/:id/merge_requests/:merge_request_iid/unapprove
```

Supported attributes:

| Attribute           | Type              | Required | Description |
|---------------------|-------------------|----------|-------------|
| `id`                | integer or string | Yes      | The ID or [URL-encoded path of a project](rest/_index.md#namespaced-paths). |
| `merge_request_iid` | integer           | Yes      | The IID of a merge request. |

## Reset approvals of a merge request

Clear all approvals of merge request.

Available only for [bot users](../user/project/settings/project_access_tokens.md#bot-users-for-projects)
based on project or group tokens. Users without bot permissions receive a `401 Unauthorized` response.

```plaintext
PUT /projects/:id/merge_requests/:merge_request_iid/reset_approvals
```

| Attribute           | Type              | Required | Description |
|---------------------|-------------------|----------|-------------|
| `id`                | integer or string | Yes      | The ID or [URL-encoded path of the project](rest/_index.md#namespaced-paths). |
| `merge_request_iid` | integer           | Yes      | The internal ID of the merge request. |

```shell
curl --request PUT \
  --header "PRIVATE-TOKEN: <your_access_token>" \
  --url "https://gitlab.example.com/api/v4/projects/76/merge_requests/1/reset_approvals"
```

## Project approval rules

Use the [project approval rules](#get-all-approval-rules-for-project) to access this information.

To request information about a project's approval configuration, use this endpoint:

```plaintext
GET /projects/:id/approvals
```

Supported attributes:

| Attribute | Type              | Required | Description |
|-----------|-------------------|----------|-------------|
| `id`      | integer or string | Yes      | The ID or [URL-encoded path of a project](rest/_index.md#namespaced-paths). |

```json
{
  "approvers": [], // Deprecated in GitLab 12.3, always returns empty
  "approver_groups": [], // Deprecated in GitLab 12.3, always returns empty
  "approvals_before_merge": 2, // Deprecated in GitLab 12.3, use Approval Rules instead
  "reset_approvals_on_push": true,
  "selective_code_owner_removals": false,
  "disable_overriding_approvers_per_merge_request": false,
  "merge_requests_author_approval": true,
  "merge_requests_disable_committers_approval": false,
  "require_password_to_approve": true, // Deprecated in 16.9, use require_reauthentication_to_approve instead
  "require_reauthentication_to_approve": true
}
```

### Change configuration

Users with the appropriate role can change approval configuration using this endpoint:

```plaintext
POST /projects/:id/approvals
```

Supported attributes:

| Attribute                                        | Type              | Required | Description |
|--------------------------------------------------|-------------------|----------|-------------|
| `id`                                             | integer or string | Yes      | The ID or [URL-encoded path of a project](rest/_index.md#namespaced-paths). |
| `approvals_before_merge` (deprecated)            | integer           | No       | The number of required approvals before a merge request can merge. [Deprecated](https://gitlab.com/gitlab-org/gitlab/-/issues/11132) in GitLab 12.3. Use [Approval Rules](#create-project-approval-rule) instead. <!-- Do not remove line until field is actually removed --> |
| `disable_overriding_approvers_per_merge_request` | boolean           | No       | Allow or prevent overriding approvers per merge request. |
| `merge_requests_author_approval`                 | boolean           | No       | Allow or prevent authors from self approving merge requests; `true` means authors can self approve. |
| `merge_requests_disable_committers_approval`     | boolean           | No       | Allow or prevent committers from self approving merge requests. |
| `require_password_to_approve` (deprecated)       | boolean           | No       | Require approver to enter a password to authenticate before adding the approval. [Deprecated](https://gitlab.com/gitlab-org/gitlab/-/issues/431346) in GitLab 16.9. Use `require_reauthentication_to_approve` instead. |
| `require_reauthentication_to_approve`            | boolean           | No       | Require approver to enter a to authenticate before adding the approval. [Introduced](https://gitlab.com/gitlab-org/gitlab/-/issues/431346) in GitLab 17.1. |
| `reset_approvals_on_push`                        | boolean           | No       | Reset approvals on a new push. |
| `selective_code_owner_removals`                  | boolean           | No       | Reset approvals from Code Owners if their files changed. You must disable the `reset_approvals_on_push` field to use this field. |

```json
{
  "approvals_before_merge": 2, // Use Approval Rules instead
  "reset_approvals_on_push": true,
  "selective_code_owner_removals": false,
  "disable_overriding_approvers_per_merge_request": false,
  "merge_requests_author_approval": false,
  "merge_requests_disable_committers_approval": false,
  "require_password_to_approve": true,
  "require_reauthentication_to_approve": true
}
```

### Get all approval rules for project

To request information about a project's approval rules, use this endpoint:

```plaintext
GET /projects/:id/approval_rules
```

To restrict the list of approval rules, use the `page` and `per_page`
[pagination](rest/_index.md#offset-based-pagination) parameters.

Supported attributes:

| Attribute | Type              | Required | Description |
|-----------|-------------------|----------|-------------|
| `id`      | integer or string | Yes      | The ID or [URL-encoded path of a project](rest/_index.md#namespaced-paths). |

```json
[
  {
    "id": 1,
    "name": "security",
    "rule_type": "regular",
    "report_type": null,
    "eligible_approvers": [
      {
        "id": 5,
        "name": "John Doe",
        "username": "jdoe",
        "state": "active",
        "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
        "web_url": "http://localhost/jdoe"
      },
      {
        "id": 50,
        "name": "Group Member 1",
        "username": "group_member_1",
        "state": "active",
        "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
        "web_url": "http://localhost/group_member_1"
      }
    ],
    "approvals_required": 3,
    "users": [
      {
        "id": 5,
        "name": "John Doe",
        "username": "jdoe",
        "state": "active",
        "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
        "web_url": "http://localhost/jdoe"
      }
    ],
    "groups": [
      {
        "id": 5,
        "name": "group1",
        "path": "group1",
        "description": "",
        "visibility": "public",
        "lfs_enabled": false,
        "avatar_url": null,
        "web_url": "http://localhost/groups/group1",
        "request_access_enabled": false,
        "full_name": "group1",
        "full_path": "group1",
        "parent_id": null,
        "ldap_cn": null,
        "ldap_access": null
      }
    ],
    "applies_to_all_protected_branches": false,
    "protected_branches": [
      {
        "id": 1,
        "name": "main",
        "push_access_levels": [
          {
            "access_level": 30,
            "access_level_description": "Developers + Maintainers"
          }
        ],
        "merge_access_levels": [
          {
            "access_level": 30,
            "access_level_description": "Developers + Maintainers"
          }
        ],
        "unprotect_access_levels": [
          {
            "access_level": 40,
            "access_level_description": "Maintainers"
          }
        ],
        "code_owner_approval_required": "false"
      }
    ],
    "contains_hidden_groups": false,
  },
  {
    "id": 2,
    "name": "Coverage-Check",
    "rule_type": "report_approver",
    "report_type": "code_coverage",
    "eligible_approvers": [
      {
        "id": 5,
        "name": "John Doe",
        "username": "jdoe",
        "state": "active",
        "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
        "web_url": "http://localhost/jdoe"
      },
      {
        "id": 50,
        "name": "Group Member 1",
        "username": "group_member_1",
        "state": "active",
        "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
        "web_url": "http://localhost/group_member_1"
      }
    ],
    "approvals_required": 3,
    "users": [
      {
        "id": 5,
        "name": "John Doe",
        "username": "jdoe",
        "state": "active",
        "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
        "web_url": "http://localhost/jdoe"
      }
    ],
    "groups": [
      {
        "id": 5,
        "name": "group1",
        "path": "group1",
        "description": "",
        "visibility": "public",
        "lfs_enabled": false,
        "avatar_url": null,
        "web_url": "http://localhost/groups/group1",
        "request_access_enabled": false,
        "full_name": "group1",
        "full_path": "group1",
        "parent_id": null,
        "ldap_cn": null,
        "ldap_access": null
      }
    ],
    "applies_to_all_protected_branches": false,
    "protected_branches": [
      {
        "id": 1,
        "name": "main",
        "push_access_levels": [
          {
            "access_level": 30,
            "access_level_description": "Developers + Maintainers"
          }
        ],
        "merge_access_levels": [
          {
            "access_level": 30,
            "access_level_description": "Developers + Maintainers"
          }
        ],
        "unprotect_access_levels": [
          {
            "access_level": 40,
            "access_level_description": "Maintainers"
          }
        ],
        "code_owner_approval_required": "false"
      }
    ],
    "contains_hidden_groups": false,
  }
]
```

### Get single approval rule for project

To request information about a single project's approval rule, use this endpoint:

```plaintext
GET /projects/:id/approval_rules/:approval_rule_id
```

Supported attributes:

| Attribute          | Type              | Required | Description |
|--------------------|-------------------|----------|-------------|
| `id`               | integer or string | Yes      | The ID or [URL-encoded path of a project](rest/_index.md#namespaced-paths). |
| `approval_rule_id` | integer           | Yes      | The ID of a approval rule. |

```json
{
  "id": 1,
  "name": "security",
  "rule_type": "regular",
  "report_type": null,
  "eligible_approvers": [
    {
      "id": 5,
      "name": "John Doe",
      "username": "jdoe",
      "state": "active",
      "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
      "web_url": "http://localhost/jdoe"
    },
    {
      "id": 50,
      "name": "Group Member 1",
      "username": "group_member_1",
      "state": "active",
      "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
      "web_url": "http://localhost/group_member_1"
    }
  ],
  "approvals_required": 3,
  "users": [
    {
      "id": 5,
      "name": "John Doe",
      "username": "jdoe",
      "state": "active",
      "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
      "web_url": "http://localhost/jdoe"
    }
  ],
  "groups": [
    {
      "id": 5,
      "name": "group1",
      "path": "group1",
      "description": "",
      "visibility": "public",
      "lfs_enabled": false,
      "avatar_url": null,
      "web_url": "http://localhost/groups/group1",
      "request_access_enabled": false,
      "full_name": "group1",
      "full_path": "group1",
      "parent_id": null,
      "ldap_cn": null,
      "ldap_access": null
    }
  ],
  "applies_to_all_protected_branches": false,
  "protected_branches": [
    {
      "id": 1,
      "name": "main",
      "push_access_levels": [
        {
          "access_level": 30,
          "access_level_description": "Developers + Maintainers"
        }
      ],
      "merge_access_levels": [
        {
          "access_level": 30,
          "access_level_description": "Developers + Maintainers"
        }
      ],
      "unprotect_access_levels": [
        {
          "access_level": 40,
          "access_level_description": "Maintainers"
        }
      ],
      "code_owner_approval_required": "false"
    }
  ],
  "contains_hidden_groups": false
}
```

### Create project approval rule

To create project approval rule, use this endpoint:

```plaintext
POST /projects/:id/approval_rules
```

Supported attributes:

| Attribute                           | Type              | Required | Description |
|-------------------------------------|-------------------|----------|-------------|
| `id`                                | integer or string | Yes      | The ID or [URL-encoded path of a project](rest/_index.md#namespaced-paths). |
| `approvals_required`                | integer           | Yes      | The number of required approvals for this rule. |
| `name`                              | string            | Yes      | The name of the approval rule. Limited to 1024 characters. |
| `applies_to_all_protected_branches` | boolean           | No       | If `true`, applies the rule to all protected branches and ignores the `protected_branch_ids` attribute. |
| `group_ids`                         | Array             | No       | The IDs of groups as approvers. |
| `protected_branch_ids`              | Array             | No       | The IDs of protected branches to scope the rule by. To identify the ID, [use the API](protected_branches.md#list-protected-branches). |
| `report_type`                       | string            | No       | The report type required when the rule type is `report_approver`. The supported report types are `license_scanning` [(Deprecated in GitLab 15.9)](../update/deprecations.md#license-check-and-the-policies-tab-on-the-license-compliance-page) and `code_coverage`. <!-- Do not remove line until field is actually removed -->  |
| `rule_type`                         | string            | No       | The rule type. `any_approver` is a pre-configured default rule with `approvals_required` at `0`. Other rules are `regular` (used for regular [merge request approval rules](../user/project/merge_requests/approvals/rules.md)) and `report_approver`. Don't use this field to build approval rules from the API. The `report_approver` field is used when GitLab creates an approval rule from configured and enabled [merge request approval policies](../user/application_security/policies/merge_request_approval_policies.md). |
| `user_ids`                          | Array             | No       | The IDs of users as approvers. If you provide both `user_ids` and `usernames`, it adds both lists of users. |
| `usernames`                         | string array      | No       | The usernames of approvers for this rule (same as `user_ids` but requires a list of usernames). If you provide both `user_ids` and `usernames`, it adds both lists of users. |

```json
{
  "id": 1,
  "name": "security",
  "rule_type": "regular",
  "eligible_approvers": [
    {
      "id": 2,
      "name": "John Doe",
      "username": "jdoe",
      "state": "active",
      "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
      "web_url": "http://localhost/jdoe"
    },
    {
      "id": 50,
      "name": "Group Member 1",
      "username": "group_member_1",
      "state": "active",
      "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
      "web_url": "http://localhost/group_member_1"
    }
  ],
  "approvals_required": 1,
  "users": [
    {
      "id": 2,
      "name": "John Doe",
      "username": "jdoe",
      "state": "active",
      "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
      "web_url": "http://localhost/jdoe"
    }
  ],
  "groups": [
    {
      "id": 5,
      "name": "group1",
      "path": "group1",
      "description": "",
      "visibility": "public",
      "lfs_enabled": false,
      "avatar_url": null,
      "web_url": "http://localhost/groups/group1",
      "request_access_enabled": false,
      "full_name": "group1",
      "full_path": "group1",
      "parent_id": null,
      "ldap_cn": null,
      "ldap_access": null
    }
  ],
  "applies_to_all_protected_branches": false,
  "protected_branches": [
    {
      "id": 1,
      "name": "main",
      "push_access_levels": [
        {
          "access_level": 30,
          "access_level_description": "Developers + Maintainers"
        }
      ],
      "merge_access_levels": [
        {
          "access_level": 30,
          "access_level_description": "Developers + Maintainers"
        }
      ],
      "unprotect_access_levels": [
        {
          "access_level": 40,
          "access_level_description": "Maintainers"
        }
      ],
      "code_owner_approval_required": "false"
    }
  ],
  "contains_hidden_groups": false
}
```

To increase the default number of 0 required approvers:

```shell
curl --request POST \
  --header "PRIVATE-TOKEN: <your_access_token>" \
  --header 'Content-Type: application/json' \
  --data '{"name": "Any name", "rule_type": "any_approver", "approvals_required": 2}' \
  --url "https://gitlab.example.com/api/v4/projects/<project_id>/approval_rules"
```

Another example is to create a user-specific rule:

```shell
curl --request POST \
  --header "PRIVATE-TOKEN: <your_access_token>" \
  --header 'Content-Type: application/json' \
  --data '{"name": "Name of your rule", "approvals_required": 3, "user_ids": [123, 456, 789]}' \
  --url "https://gitlab.example.com/api/v4/projects/<project_id>/approval_rules"
```

### Update project approval rule

To update project approval rules, use this endpoint:

```plaintext
PUT /projects/:id/approval_rules/:approval_rule_id
```

{{< alert type="note" >}}

Approvers and groups (except hidden groups not in the `users` or `groups`
parameters) are removed. Hidden groups are private groups the user doesn't
have permission to view. Hidden groups are not removed by default unless the
`remove_hidden_groups` parameter is `true`. This ensures hidden groups are
not removed unintentionally when a user updates an approval rule.

{{< /alert >}}

Supported attributes:

| Attribute                           | Type              | Required | Description |
|-------------------------------------|-------------------|----------|-------------|
| `approval_rule_id`                  | integer           | Yes      | The ID of a approval rule. |
| `id`                                | integer or string | Yes      | The ID or [URL-encoded path of a project](rest/_index.md#namespaced-paths). |
| `applies_to_all_protected_branches` | boolean           | No       | If `true`, applies the rule to all protected branches and ignores the `protected_branch_ids` attribute. |
| `approvals_required`                | integer           | No       | The number of required approvals for this rule. |
| `group_ids`                         | Array             | No       | The IDs of groups as approvers. |
| `name`                              | string            | No       | The name of the approval rule. Limited to 1024 characters. |
| `protected_branch_ids`              | Array             | No       | The IDs of protected branches to scope the rule by. To identify the ID, [use the API](protected_branches.md#list-protected-branches). |
| `remove_hidden_groups`              | boolean           | No       | Whether to remove hidden groups from the approval rule. |
| `user_ids`                          | Array             | No       | The IDs of users as approvers. If you provide both `user_ids` and `usernames`, it adds both lists of users. |
| `usernames`                         | string array      | No       | The usernames of approvers for this rule (same as `user_ids` but requires a list of usernames). If you provide both `user_ids` and `usernames`, it adds both lists of users. |

```json
{
  "id": 1,
  "name": "security",
  "rule_type": "regular",
  "eligible_approvers": [
    {
      "id": 2,
      "name": "John Doe",
      "username": "jdoe",
      "state": "active",
      "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
      "web_url": "http://localhost/jdoe"
    },
    {
      "id": 50,
      "name": "Group Member 1",
      "username": "group_member_1",
      "state": "active",
      "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
      "web_url": "http://localhost/group_member_1"
    }
  ],
  "approvals_required": 1,
  "users": [
    {
      "id": 2,
      "name": "John Doe",
      "username": "jdoe",
      "state": "active",
      "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
      "web_url": "http://localhost/jdoe"
    }
  ],
  "groups": [
    {
      "id": 5,
      "name": "group1",
      "path": "group1",
      "description": "",
      "visibility": "public",
      "lfs_enabled": false,
      "avatar_url": null,
      "web_url": "http://localhost/groups/group1",
      "request_access_enabled": false,
      "full_name": "group1",
      "full_path": "group1",
      "parent_id": null,
      "ldap_cn": null,
      "ldap_access": null
    }
  ],
  "applies_to_all_protected_branches": false,
  "protected_branches": [
    {
      "id": 1,
      "name": "main",
      "push_access_levels": [
        {
          "access_level": 30,
          "access_level_description": "Developers + Maintainers"
        }
      ],
      "merge_access_levels": [
        {
          "access_level": 30,
          "access_level_description": "Developers + Maintainers"
        }
      ],
      "unprotect_access_levels": [
        {
          "access_level": 40,
          "access_level_description": "Maintainers"
        }
      ],
      "code_owner_approval_required": "false"
    }
  ],
  "contains_hidden_groups": false
}
```

### Delete project approval rule

To delete project approval rules, use this endpoint:

```plaintext
DELETE /projects/:id/approval_rules/:approval_rule_id
```

Supported attributes:

| Attribute          | Type              | Required | Description |
|--------------------|-------------------|----------|-------------|
| `id`               | integer or string | Yes      | The ID or [URL-encoded path of a project](rest/_index.md#namespaced-paths). |
| `approval_rule_id` | integer           | Yes      | The ID of a approval rule. |

## Single merge request approval

Configuration for approvals on a specific merge request. All endpoints require authentication.

To request information about a merge request's approval status, use this endpoint:

```plaintext
GET /projects/:id/merge_requests/:merge_request_iid/approvals
```

Supported attributes:

| Attribute           | Type              | Required | Description |
|---------------------|-------------------|----------|-------------|
| `id`                | integer or string | Yes      | The ID or [URL-encoded path of a project](rest/_index.md#namespaced-paths). |
| `merge_request_iid` | integer           | Yes      | The IID of the merge request. |

```json
{
  "id": 5,
  "iid": 5,
  "project_id": 1,
  "title": "Approvals API",
  "description": "Test",
  "state": "opened",
  "created_at": "2016-06-08T00:19:52.638Z",
  "updated_at": "2016-06-08T21:20:42.470Z",
  "merge_status": "cannot_be_merged",
  "approvals_required": 2,
  "approvals_left": 1,
  "approved_by": [
    {
      "user": {
        "name": "Administrator",
        "username": "root",
        "id": 1,
        "state": "active",
        "avatar_url": "http://www.gravatar.com/avatar/e64c7d89f26bd1972efa854d13d7dd61?s=80\u0026d=identicon",
        "web_url": "http://localhost:3000/root"
      }
    }
  ]
}
```

### Get the approval state of merge requests

To request information about a merge request's approval state, use this endpoint:

```plaintext
GET /projects/:id/merge_requests/:merge_request_iid/approval_state
```

The `approval_rules_overwritten` are `true` if the merge request level rules
are created for the merge request. If there are none, it is `false`.

This includes more information about the users who have already approved
(`approved_by`) and whether a rule is already approved (`approved`).

Supported attributes:

| Attribute           | Type              | Required | Description |
|---------------------|-------------------|----------|-------------|
| `id`                | integer or string | Yes      | The ID or [URL-encoded path of a project](rest/_index.md#namespaced-paths). |
| `merge_request_iid` | integer           | Yes      | The IID of the merge request. |

```json
{
  "approval_rules_overwritten": true,
  "rules": [
    {
      "id": 1,
      "name": "Ruby",
      "rule_type": "regular",
      "eligible_approvers": [
        {
          "id": 4,
          "name": "John Doe",
          "username": "jdoe",
          "state": "active",
          "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
          "web_url": "http://localhost/jdoe"
        }
      ],
      "approvals_required": 2,
      "users": [
        {
          "id": 4,
          "name": "John Doe",
          "username": "jdoe",
          "state": "active",
          "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
          "web_url": "http://localhost/jdoe"
        }
      ],
      "groups": [],
      "contains_hidden_groups": false,
      "approved_by": [
        {
          "id": 4,
          "name": "John Doe",
          "username": "jdoe",
          "state": "active",
          "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
          "web_url": "http://localhost/jdoe"
        }
      ],
      "source_rule": null,
      "approved": true,
      "overridden": false
    }
  ]
}
```

### Get merge request approval rules

To request information about a merge request's approval rules, use this endpoint:

```plaintext
GET /projects/:id/merge_requests/:merge_request_iid/approval_rules
```

Use the `page` and `per_page` [pagination](rest/_index.md#offset-based-pagination) parameters to restrict the list of approval rules.

Supported attributes:

| Attribute           | Type              | Required | Description |
|---------------------|-------------------|----------|-------------|
| `id`                | integer or string | Yes      | The ID or [URL-encoded path of a project](rest/_index.md#namespaced-paths). |
| `merge_request_iid` | integer           | Yes      | The IID of the merge request. |

```json
[
  {
    "id": 1,
    "name": "security",
    "rule_type": "regular",
    "report_type": null,
    "eligible_approvers": [
      {
        "id": 5,
        "name": "John Doe",
        "username": "jdoe",
        "state": "active",
        "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
        "web_url": "http://localhost/jdoe"
      },
      {
        "id": 50,
        "name": "Group Member 1",
        "username": "group_member_1",
        "state": "active",
        "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
        "web_url": "http://localhost/group_member_1"
      }
    ],
    "approvals_required": 3,
    "source_rule": null,
    "users": [
      {
        "id": 5,
        "name": "John Doe",
        "username": "jdoe",
        "state": "active",
        "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
        "web_url": "http://localhost/jdoe"
      }
    ],
    "groups": [
      {
        "id": 5,
        "name": "group1",
        "path": "group1",
        "description": "",
        "visibility": "public",
        "lfs_enabled": false,
        "avatar_url": null,
        "web_url": "http://localhost/groups/group1",
        "request_access_enabled": false,
        "full_name": "group1",
        "full_path": "group1",
        "parent_id": null,
        "ldap_cn": null,
        "ldap_access": null
      }
    ],
    "contains_hidden_groups": false,
    "overridden": false
  },
  {
    "id": 2,
    "name": "Coverage-Check",
    "rule_type": "report_approver",
    "report_type": "code_coverage",
    "eligible_approvers": [
      {
        "id": 5,
        "name": "John Doe",
        "username": "jdoe",
        "state": "active",
        "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
        "web_url": "http://localhost/jdoe"
      },
      {
        "id": 50,
        "name": "Group Member 1",
        "username": "group_member_1",
        "state": "active",
        "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
        "web_url": "http://localhost/group_member_1"
      }
    ],
    "approvals_required": 3,
    "source_rule": null,
    "users": [
      {
        "id": 5,
        "name": "John Doe",
        "username": "jdoe",
        "state": "active",
        "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
        "web_url": "http://localhost/jdoe"
      }
    ],
    "groups": [
      {
        "id": 5,
        "name": "group1",
        "path": "group1",
        "description": "",
        "visibility": "public",
        "lfs_enabled": false,
        "avatar_url": null,
        "web_url": "http://localhost/groups/group1",
        "request_access_enabled": false,
        "full_name": "group1",
        "full_path": "group1",
        "parent_id": null,
        "ldap_cn": null,
        "ldap_access": null
      }
    ],
    "contains_hidden_groups": false,
    "overridden": false
  }
]
```

### Get a single merge request rule

To request information about a single merge request approval rule, use this endpoint:

```plaintext
GET /projects/:id/merge_requests/:merge_request_iid/approval_rules/:approval_rule_id
```

Supported attributes:

| Attribute           | Type              | Required | Description |
|---------------------|-------------------|----------|-------------|
| `id`                | integer or string | Yes      | The ID or [URL-encoded path of a project](rest/_index.md#namespaced-paths). |
| `approval_rule_id`  | integer           | Yes      | The ID of an approval rule. |
| `merge_request_iid` | integer           | Yes      | The IID of a merge request. |

```json
{
  "id": 1,
  "name": "security",
  "rule_type": "regular",
  "report_type": null,
  "eligible_approvers": [
    {
      "id": 5,
      "name": "John Doe",
      "username": "jdoe",
      "state": "active",
      "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
      "web_url": "http://localhost/jdoe"
    },
    {
      "id": 50,
      "name": "Group Member 1",
      "username": "group_member_1",
      "state": "active",
      "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
      "web_url": "http://localhost/group_member_1"
    }
  ],
  "approvals_required": 3,
  "source_rule": null,
  "users": [
    {
      "id": 5,
      "name": "John Doe",
      "username": "jdoe",
      "state": "active",
      "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
      "web_url": "http://localhost/jdoe"
    }
  ],
  "groups": [
    {
      "id": 5,
      "name": "group1",
      "path": "group1",
      "description": "",
      "visibility": "public",
      "lfs_enabled": false,
      "avatar_url": null,
      "web_url": "http://localhost/groups/group1",
      "request_access_enabled": false,
      "full_name": "group1",
      "full_path": "group1",
      "parent_id": null,
      "ldap_cn": null,
      "ldap_access": null
    }
  ],
  "contains_hidden_groups": false,
  "overridden": false
}
```

### Create merge request rule

To create merge request approval rules, use this endpoint:

```plaintext
POST /projects/:id/merge_requests/:merge_request_iid/approval_rules
```

Supported attributes:

| Attribute                  | Type              | Required               | Description                                                                  |
|----------------------------|-------------------|------------------------|------------------------------------------------------------------------------|
| `id`                       | integer or string | Yes | The ID or [URL-encoded path of a project](rest/_index.md#namespaced-paths) |
| `approvals_required`       | integer           | Yes | The number of required approvals for this rule.                              |
| `merge_request_iid`        | integer           | Yes | The IID of the merge request.                                                |
| `name`                     | string            | Yes | The name of the approval rule. Limited to 1024 characters.                                               |
| `approval_project_rule_id` | integer           | No | The ID of a project's approval rule.                                     |
| `group_ids`                | Array             | No | The IDs of groups as approvers.                                              |
| `user_ids`                 | Array             | No | The IDs of users as approvers. If you provide both `user_ids` and `usernames`, it adds both lists of users. |
| `usernames`                | string array      | No | The usernames of approvers for this rule (same as `user_ids` but requires a list of usernames). If you provide both `user_ids` and `usernames`, it adds both lists of users. |

{{< alert type="note" >}}

Setting `approval_project_rule_id` copies the `name`, `users` and
`groups` of the project's rule. It uses the `approvals_required` you specify.

{{< /alert >}}

```json
{
  "id": 1,
  "name": "security",
  "rule_type": "regular",
  "eligible_approvers": [
    {
      "id": 2,
      "name": "John Doe",
      "username": "jdoe",
      "state": "active",
      "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
      "web_url": "http://localhost/jdoe"
    },
    {
      "id": 50,
      "name": "Group Member 1",
      "username": "group_member_1",
      "state": "active",
      "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
      "web_url": "http://localhost/group_member_1"
    }
  ],
  "approvals_required": 1,
  "source_rule": null,
  "users": [
    {
      "id": 2,
      "name": "John Doe",
      "username": "jdoe",
      "state": "active",
      "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
      "web_url": "http://localhost/jdoe"
    }
  ],
  "groups": [
    {
      "id": 5,
      "name": "group1",
      "path": "group1",
      "description": "",
      "visibility": "public",
      "lfs_enabled": false,
      "avatar_url": null,
      "web_url": "http://localhost/groups/group1",
      "request_access_enabled": false,
      "full_name": "group1",
      "full_path": "group1",
      "parent_id": null,
      "ldap_cn": null,
      "ldap_access": null
    }
  ],
  "contains_hidden_groups": false,
  "overridden": false
}
```

### Update merge request rule

To update merge request approval rules, use this endpoint:

```plaintext
PUT /projects/:id/merge_requests/:merge_request_iid/approval_rules/:approval_rule_id
```

This endpoint removes any approvers and groups not in the `users` or `groups` parameters.

The `report_approver` or `code_owner` rules are system-generated, and you cannot edit them.

Supported attributes:

| Attribute              | Type              | Required | Description |
|------------------------|-------------------|----------|-------------|
| `id`                   | integer or string | Yes      | The ID or [URL-encoded path of a project](rest/_index.md#namespaced-paths). |
| `approval_rule_id`     | integer           | Yes      | The ID of an approval rule. |
| `merge_request_iid`    | integer           | Yes      | The IID of a merge request. |
| `approvals_required`   | integer           | No       | The number of required approvals for this rule. |
| `group_ids`            | Array             | No       | The IDs of groups as approvers. |
| `name`                 | string            | No       | The name of the approval rule. Limited to 1024 characters. |
| `remove_hidden_groups` | boolean           | No       | Whether to remove hidden groups. |
| `user_ids`             | Array             | No       | The IDs of users as approvers. If you provide both `user_ids` and `usernames`, it adds both lists of users. |
| `usernames`            | string array      | No       | The usernames of approvers for this rule (same as `user_ids` but requires a list of usernames). If you provide both `user_ids` and `usernames`, it adds both lists of users. |

```json
{
  "id": 1,
  "name": "security",
  "rule_type": "regular",
  "eligible_approvers": [
    {
      "id": 2,
      "name": "John Doe",
      "username": "jdoe",
      "state": "active",
      "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
      "web_url": "http://localhost/jdoe"
    },
    {
      "id": 50,
      "name": "Group Member 1",
      "username": "group_member_1",
      "state": "active",
      "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
      "web_url": "http://localhost/group_member_1"
    }
  ],
  "approvals_required": 1,
  "source_rule": null,
  "users": [
    {
      "id": 2,
      "name": "John Doe",
      "username": "jdoe",
      "state": "active",
      "avatar_url": "https://www.gravatar.com/avatar/0?s=80&d=identicon",
      "web_url": "http://localhost/jdoe"
    }
  ],
  "groups": [
    {
      "id": 5,
      "name": "group1",
      "path": "group1",
      "description": "",
      "visibility": "public",
      "lfs_enabled": false,
      "avatar_url": null,
      "web_url": "http://localhost/groups/group1",
      "request_access_enabled": false,
      "full_name": "group1",
      "full_path": "group1",
      "parent_id": null,
      "ldap_cn": null,
      "ldap_access": null
    }
  ],
  "contains_hidden_groups": false,
  "overridden": false
}
```

### Delete merge request rule

To delete merge request approval rules, use this endpoint:

```plaintext
DELETE /projects/:id/merge_requests/:merge_request_iid/approval_rules/:approval_rule_id
```

The `report_approver` or `code_owner` rules are system-generated, and you cannot edit them.

Supported attributes:

| Attribute           | Type              | Required | Description |
|---------------------|-------------------|----------|-------------|
| `id`                | integer or string | Yes      | The ID or [URL-encoded path of a project](rest/_index.md#namespaced-paths). |
| `approval_rule_id`  | integer           | Yes      | The ID of an approval rule. |
| `merge_request_iid` | integer           | Yes      | The IID of the merge request. |

## Group approval rules

{{< details >}}

- Status: Experiment

{{< /details >}}

{{< history >}}

- [Introduced](https://gitlab.com/gitlab-org/gitlab/-/issues/428051) in GitLab 16.7 [with a flag](../administration/feature_flags/_index.md) named `approval_group_rules`. Disabled by default. This feature is an [experiment](../policy/development_stages_support.md).

{{< /history >}}

{{< alert type="flag" >}}

On GitLab Self-Managed, by default this feature is not available. To make it available, an administrator can [enable the feature flag](../administration/feature_flags/_index.md) named `approval_group_rules`.
On GitLab.com and GitLab Dedicated, this feature is not available.
This feature is not ready for production use.

{{< /alert >}}

Group approval rules apply to all protected branches of projects belonging to the group.

### Get group approval rules

{{< history >}}

- [Introduced](https://gitlab.com/gitlab-org/gitlab/-/issues/440638) in GitLab 16.10.

{{< /history >}}

Group admins can request information about a group's approval rules using the following endpoint:

```plaintext
GET /groups/:id/approval_rules
```

Use the `page` and `per_page` [pagination](rest/_index.md#offset-based-pagination) parameters to restrict the list of approval rules.

Supported attributes:

| Attribute | Type              | Required | Description |
|-----------|-------------------|----------|-------------|
| `id`      | integer or string | Yes      | The ID or [URL-encoded path of a project](rest/_index.md#namespaced-paths). |

Example request:

```shell
curl --request GET \
  --header "PRIVATE-TOKEN: <your_access_token>" \
  --url "https://gitlab.example.com/api/v4/groups/29/approval_rules"
```

Example response:

```json
[
  {
    "id": 2,
    "name": "rule1",
    "rule_type": "any_approver",
    "report_type": null,
    "eligible_approvers": [],
    "approvals_required": 3,
    "users": [],
    "groups": [],
    "contains_hidden_groups": false,
    "protected_branches": [],
    "applies_to_all_protected_branches": true
  },
  {
    "id": 3,
    "name": "rule2",
    "rule_type": "code_owner",
    "report_type": null,
    "eligible_approvers": [],
    "approvals_required": 2,
    "users": [],
    "groups": [],
    "contains_hidden_groups": false,
    "protected_branches": [],
    "applies_to_all_protected_branches": true
  },
  {
    "id": 4,
    "name": "rule2",
    "rule_type": "report_approver",
    "report_type": "code_coverage",
    "eligible_approvers": [],
    "approvals_required": 2,
    "users": [],
    "groups": [],
    "contains_hidden_groups": false,
    "protected_branches": [],
    "applies_to_all_protected_branches": true
  }
]

```

### Create group approval rules

Group admins can create approval rules for a group using the following endpoint:

```plaintext
POST /groups/:id/approval_rules
```

Supported attributes:

| Attribute            | Type              | Required | Description |
|----------------------|-------------------|----------|-------------|
| `id`                 | integer or string | Yes      | The ID or [URL-encoded path of a group](rest/_index.md#namespaced-paths). |
| `approvals_required` | integer           | Yes      | The number of required approvals for this rule. |
| `name`               | string            | Yes      | The name of the approval rule. Limited to 1024 characters. |
| `group_ids`          | array             | No       | The IDs of groups as approvers. |
| `rule_type`          | string            | No       | The rule type. `any_approver` is a pre-configured default rule with `approvals_required` at `0`. Other rules are `regular` (used for regular [merge request approval rules](../user/project/merge_requests/approvals/rules.md)) and `report_approver`. Don't use this field to build approval rules from the API. The `report_approver` field is used when GitLab creates an approval rule from configured and enabled [merge request approval policies](../user/application_security/policies/merge_request_approval_policies.md). |
| `user_ids`           | array             | No       | The IDs of users as approvers. |

Example request:

```shell
curl --request POST \
  --header "PRIVATE-TOKEN: <your_access_token>" \
  --url "https://gitlab.example.com/api/v4/groups/29/approval_rules?name=security&approvals_required=2"
```

Example response:

```json
{
  "id": 5,
  "name": "security",
  "rule_type": "any_approver",
  "eligible_approvers": [],
  "approvals_required": 2,
  "users": [],
  "groups": [],
  "contains_hidden_groups": false,
  "protected_branches": [
    {
      "id": 5,
      "name": "master",
      "push_access_levels": [
        {
          "id": 5,
          "access_level": 40,
          "access_level_description": "Maintainers",
          "deploy_key_id": null,
          "user_id": null,
          "group_id": null
        }
      ],
      "merge_access_levels": [
        {
          "id": 5,
          "access_level": 40,
          "access_level_description": "Maintainers",
          "user_id": null,
          "group_id": null
        }
      ],
      "allow_force_push": false,
      "unprotect_access_levels": [],
      "code_owner_approval_required": false,
      "inherited": false
    }
  ],
  "applies_to_all_protected_branches": true
}
```

### Update group approval rules

{{< history >}}

- [Introduced](https://gitlab.com/gitlab-org/gitlab/-/issues/440639) in GitLab 16.10.

{{< /history >}}

Group admins can update group approval rules using the following endpoint:

```shell
PUT /groups/:id/approval_rules/:approval_rule_id
```

Supported attributes:

| Attribute            | Type              | Required | Description |
|----------------------|-------------------|----------|-------------|
| `approval_rule_id`.  | integer           | Yes      | The ID of the approval rule. |
| `id`                 | integer or string | Yes      | The ID or [URL-encoded path of a group](rest/_index.md#namespaced-paths). |
| `approvals_required` | string            | No       | The number of required approvals for this rule. |
| `group_ids`          | integer           | No       | The IDs of users as approvers. |
| `name`               | string            | No       | The name of the approval rule. Limited to 1024 characters. |
| `rule_type`          | array             | No       | The rule type. `any_approver` is a pre-configured default rule with `approvals_required` at `0`. Other rules are `regular` (used for regular [merge request approval rules](../user/project/merge_requests/approvals/rules.md)) and `report_approver`. Don't use this field to build approval rules from the API. The `report_approver` field is used when GitLab creates an approval rule from configured and enabled [merge request approval policies](../user/application_security/policies/merge_request_approval_policies.md). |
| `user_ids`           | array             | No       | The IDs of groups as approvers. |

Example request:

```shell
curl --request PUT \
  --header "PRIVATE-TOKEN: <your_access_token>" \
  --url "https://gitlab.example.com/api/v4/groups/29/approval_rules/5?name=security2&approvals_required=1"
```

Example response:

```json
{
  "id": 5,
  "name": "security2",
  "rule_type": "any_approver",
  "eligible_approvers": [],
  "approvals_required": 1,
  "users": [],
  "groups": [],
  "contains_hidden_groups": false,
  "protected_branches": [
    {
      "id": 5,
      "name": "master",
      "push_access_levels": [
        {
          "id": 5,
          "access_level": 40,
          "access_level_description": "Maintainers",
          "deploy_key_id": null,
          "user_id": null,
          "group_id": null
        }
      ],
      "merge_access_levels": [
        {
          "id": 5,
          "access_level": 40,
          "access_level_description": "Maintainers",
          "user_id": null,
          "group_id": null
        }
      ],
      "allow_force_push": false,
      "unprotect_access_levels": [],
      "code_owner_approval_required": false,
      "inherited": false
    }
  ],
  "applies_to_all_protected_branches": true
}
```
