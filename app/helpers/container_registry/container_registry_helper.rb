# frozen_string_literal: true

module ContainerRegistry
  module ContainerRegistryHelper
    def container_repository_gid_prefix
      "gid://#{GlobalID.app}/#{ContainerRepository.name}/"
    end

    def project_container_registry_template_data(project, connection_error, invalid_path_error)
      {
        endpoint: project_container_registry_index_path(project),
        expiration_policy: project.container_expiration_policy.to_json,
        help_page_path: help_page_path('user/packages/container_registry/index.md'),
        two_factor_auth_help_link: help_page_path('user/profile/account/two_factor_authentication.md'),
        personal_access_tokens_help_link: help_page_path('user/profile/personal_access_tokens.md'),
        no_containers_image: image_path('illustrations/docker-empty-state.svg'),
        containers_error_image: image_path('illustrations/docker-error-state.svg'),
        repository_url: escape_once(project.container_registry_url),
        registry_host_url_with_port: escape_once(registry_config.host_port),
        expiration_policy_help_page_path:
          help_page_path('user/packages/container_registry/reduce_container_registry_storage.md',
            anchor: 'cleanup-policy'),
        garbage_collection_help_page_path: help_page_path('administration/packages/container_registry.md',
          anchor: 'container-registry-garbage-collection'),
        run_cleanup_policies_help_page_path: help_page_path('administration/packages/container_registry.md',
          anchor: 'run-the-cleanup-policy-now'),
        project_path: project.full_path,
        gid_prefix: container_repository_gid_prefix,
        is_admin: current_user&.admin.to_s,
        show_cleanup_policy_link: show_cleanup_policy_link(project).to_s,
        show_container_registry_settings: show_container_registry_settings(project).to_s,
        cleanup_policies_settings_path: cleanup_image_tags_project_settings_packages_and_registries_path(project),
        connection_error: (!!connection_error).to_s,
        invalid_path_error: (!!invalid_path_error).to_s,
        user_callouts_path: callouts_path,
        user_callout_id: Users::CalloutsHelper::UNFINISHED_TAG_CLEANUP_CALLOUT,
        is_metadata_database_enabled: ContainerRegistry::GitlabApiClient.supports_gitlab_api?.to_s,
        show_unfinished_tag_cleanup_callout: show_unfinished_tag_cleanup_callout?.to_s
      }
    end
  end
end
