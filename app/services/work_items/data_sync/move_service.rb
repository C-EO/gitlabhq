# frozen_string_literal: true

module WorkItems
  module DataSync
    class MoveService < ::WorkItems::DataSync::BaseService
      class << self
        def transaction_callback(new_work_item, original_work_item, current_user)
          original_work_item.update(moved_to: new_work_item)

          close_original_work_item(current_user, new_work_item, original_work_item)
          move_system_notes(current_user, new_work_item, original_work_item)
        end

        private

        def move_system_notes(current_user, new_work_item, original_work_item)
          SystemNoteService.noteable_moved(
            new_work_item,
            new_work_item.project,
            original_work_item,
            current_user,
            direction: :from
          )

          SystemNoteService.noteable_moved(
            original_work_item,
            original_work_item.project,
            new_work_item,
            current_user,
            direction: :to
          )
        end

        def close_original_work_item(current_user, new_work_item, original_work_item)
          context = { original: original_work_item, user: current_user }

          # We need this because move work item is supposed to work with epics and for EpicWorkItem
          # Issues::CloseService also enqueues a job for ::WorkItems::ValidateEpicWorkItemSyncWorker and because
          # this is being run within a transaction, we are delaying the close operation until after commit.
          new_work_item.run_after_commit_or_now do
            close_service = ::Issues::CloseService.new(
              container: context[:original].namespace, current_user: context[:user]
            )
            close_service.execute(context[:original], notifications: false, system_note: true)
          end
        end
      end

      private

      def verify_work_item_action_permission
        verify_can_move_work_item(work_item, target_namespace)
      end

      def data_sync_action
        move_work_item
      end

      def verify_can_move_work_item(work_item, target_namespace)
        if same_namespace?(target_namespace, work_item)
          error_message = s_('MoveWorkItem|Cannot move work item to same project or group it originates from.')

          return error(error_message, :unprocessable_entity)
        end

        unless work_item.namespace.instance_of?(target_namespace.class)
          error_message = s_('MoveWorkItem|Cannot move work item between Projects and Groups.')

          return error(error_message, :unprocessable_entity)
        end

        unless work_item.supports_move_and_clone? || move_any_work_item_type
          error_message = format(s_('MoveWorkItem|Cannot move work items of \'%{issue_type}\' type.'),
            { issue_type: work_item.work_item_type.name })

          return error(error_message, :unprocessable_entity)
        end

        unless work_item.can_move?(current_user, target_namespace)
          error_message = s_('MoveWorkItem|Cannot move work item due to insufficient permissions.')

          return error(error_message, :unprocessable_entity)
        end

        if target_namespace.pending_delete?
          error_message = s_('MoveWorkItem|Cannot move work item to target namespace as it is pending deletion.')

          return error(error_message, :unprocessable_entity)
        end

        success({})
      end

      def same_namespace?(target_namespace, work_item)
        (target_namespace.instance_of?(::Project) && work_item.project_id == target_namespace.id) ||
          (work_item.namespace.instance_of?(target_namespace.class) && work_item.namespace_id == target_namespace.id)
      end

      def move_work_item
        create_response = WorkItems::DataSync::Handlers::CopyDataHandler.new(
          work_item: work_item,
          target_namespace: target_namespace,
          current_user: current_user,
          target_work_item_type: work_item.work_item_type,
          params: params.merge(operation: :move, sync_data_params: { **@execution_arguments }),
          overwritten_params: {
            moved_issue: true
          }
        ).execute

        return create_response unless create_response.success? && create_response[:work_item].present?

        # this service is based on Issues::CloseService#execute, which does not provide a clear return, so we'll skip
        # handling it for now. This will be moved to a cleanup service that would be more result oriented where we can
        # handle the service response status
        WorkItems::DataSync::Handlers::CleanupDataHandler.new(
          work_item: work_item, current_user: current_user, params: params
        ).execute

        create_response
      end

      def move_any_work_item_type
        @execution_arguments.present? && !!@execution_arguments[:skip_work_item_type_check]
      end
    end
  end
end
