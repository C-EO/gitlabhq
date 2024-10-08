import { GlAlert, GlForm } from '@gitlab/ui';
import { shallowMount } from '@vue/test-utils';
import Vue, { nextTick } from 'vue';
import VueApollo from 'vue-apollo';
import createMockApollo from 'helpers/mock_apollo_helper';
import waitForPromises from 'helpers/wait_for_promises';
import EditedAt from '~/issues/show/components/edited.vue';
import { updateDraft } from '~/lib/utils/autosave';
import { confirmAction } from '~/lib/utils/confirm_via_gl_modal/confirm_via_gl_modal';
import { ENTER_KEY } from '~/lib/utils/keys';
import MarkdownEditor from '~/vue_shared/components/markdown/markdown_editor.vue';
import WorkItemDescription from '~/work_items/components/work_item_description.vue';
import WorkItemDescriptionRendered from '~/work_items/components/work_item_description_rendered.vue';
import updateWorkItemMutation from '~/work_items/graphql/update_work_item.mutation.graphql';
import workItemByIidQuery from '~/work_items/graphql/work_item_by_iid.query.graphql';
import { autocompleteDataSources, markdownPreviewPath, newWorkItemId } from '~/work_items/utils';
import {
  updateWorkItemMutationResponse,
  workItemByIidResponseFactory,
  workItemQueryResponse,
} from '../mock_data';

jest.mock('~/lib/utils/confirm_via_gl_modal/confirm_via_gl_modal');
jest.mock('~/lib/utils/autosave');

describe('WorkItemDescription', () => {
  let wrapper;

  Vue.use(VueApollo);

  const mutationSuccessHandler = jest.fn().mockResolvedValue(updateWorkItemMutationResponse);
  const findForm = () => wrapper.findComponent(GlForm);
  const findMarkdownEditor = () => wrapper.findComponent(MarkdownEditor);
  const findRenderedDescription = () => wrapper.findComponent(WorkItemDescriptionRendered);
  const findEditedAt = () => wrapper.findComponent(EditedAt);
  const findConflictsAlert = () => wrapper.findComponent(GlAlert);
  const findConflictedDescription = () => wrapper.find('[data-testid="conflicted-description"]');

  const editDescription = (newText) => findMarkdownEditor().vm.$emit('input', newText);

  const findCancelButton = () => wrapper.find('[data-testid="cancel"]');
  const findSubmitButton = () => wrapper.find('[data-testid="save-description"]');
  const clickCancel = () => findForm().vm.$emit('reset', new Event('reset'));

  const createComponent = async ({
    mutationHandler = mutationSuccessHandler,
    canUpdate = true,
    workItemResponse = workItemByIidResponseFactory({ canUpdate }),
    workItemResponseHandler = jest.fn().mockResolvedValue(workItemResponse),
    isEditing = false,
    isGroup = false,
    workItemId = workItemQueryResponse.data.workItem.id,
    workItemIid = '1',
    workItemTypeId = workItemQueryResponse.data.workItem.workItemType.id,
    workItemTypeName = workItemQueryResponse.data.workItem.workItemType.name,
    editMode = false,
    showButtonsBelowField,
  } = {}) => {
    wrapper = shallowMount(WorkItemDescription, {
      apolloProvider: createMockApollo([
        [workItemByIidQuery, workItemResponseHandler],
        [updateWorkItemMutation, mutationHandler],
      ]),
      propsData: {
        fullPath: 'test-project-path',
        workItemId,
        workItemIid,
        workItemTypeId,
        workItemTypeName,
        editMode,
        showButtonsBelowField,
      },
      provide: {
        isGroup,
      },
      stubs: {
        GlAlert,
      },
    });

    await waitForPromises();

    if (isEditing) {
      findRenderedDescription().vm.$emit('startEditing');

      await nextTick();
    }
  };

  describe('editing description', () => {
    it('passes correct autocompletion data and preview markdown sources and enables quick actions', async () => {
      const {
        iid,
        namespace: { fullPath },
      } = workItemQueryResponse.data.workItem;

      await createComponent({ isEditing: true });

      expect(findMarkdownEditor().props()).toMatchObject({
        supportsQuickActions: true,
        renderMarkdownPath: markdownPreviewPath({ fullPath, iid }),
        autocompleteDataSources: autocompleteDataSources({ fullPath, iid }),
      });
    });

    it('passes correct autocompletion data sources when it is a group work item', async () => {
      const {
        iid,
        namespace: { fullPath },
      } = workItemQueryResponse.data.workItem;

      const workItemResponse = workItemByIidResponseFactory();

      const groupWorkItem = {
        data: {
          workspace: {
            __typename: 'Group',
            id: 'gid://gitlab/Group/24',
            workItem: {
              ...workItemResponse.data.workspace.workItem,
              namespace: {
                id: 'gid://gitlab/Group/24',
                fullPath: 'gitlab-org',
                name: 'Gitlab Org',
                __typename: 'Namespace',
              },
            },
          },
        },
      };

      createComponent({ isEditing: true, workItemResponse: groupWorkItem, isGroup: true });

      await waitForPromises();

      expect(findMarkdownEditor().props()).toMatchObject({
        supportsQuickActions: true,
        renderMarkdownPath: markdownPreviewPath({ fullPath, iid, isGroup: true }),
        autocompleteDataSources: autocompleteDataSources({
          fullPath,
          iid,
          isGroup: true,
        }),
      });
    });

    it('shows edited by text', async () => {
      const lastEditedAt = '2022-09-21T06:18:42Z';
      const lastEditedBy = {
        name: 'Administrator',
        webPath: '/root',
      };

      await createComponent({
        workItemResponse: workItemByIidResponseFactory({ lastEditedAt, lastEditedBy }),
      });

      expect(findEditedAt().props()).toMatchObject({
        updatedAt: lastEditedAt,
        updatedByName: lastEditedBy.name,
        updatedByPath: lastEditedBy.webPath,
      });
    });

    it('does not show edited by text', async () => {
      await createComponent();

      expect(findEditedAt().exists()).toBe(false);
    });

    it('cancels when clicking cancel', async () => {
      await createComponent({
        isEditing: true,
      });

      clickCancel();

      await nextTick();

      expect(confirmAction).not.toHaveBeenCalled();
      expect(findMarkdownEditor().exists()).toBe(false);
    });

    it('prompts for confirmation when clicking cancel after changes', async () => {
      await createComponent({
        isEditing: true,
      });

      editDescription('updated desc');

      clickCancel();

      await nextTick();

      expect(confirmAction).toHaveBeenCalled();
    });

    it('autosaves description', async () => {
      await createComponent({
        isEditing: true,
      });

      editDescription('updated desc');

      expect(updateDraft).toHaveBeenCalled();
    });

    it('maps submit and cancel buttons to form actions', async () => {
      await createComponent({
        isEditing: true,
      });

      expect(findCancelButton().attributes('type')).toBe('reset');
      expect(findSubmitButton().attributes('type')).toBe('submit');
    });

    it('hides buttons when showButtonsBelowField is false', async () => {
      await createComponent({
        isEditing: true,
        showButtonsBelowField: false,
      });

      expect(findCancelButton().exists()).toBe(false);
      expect(findSubmitButton().exists()).toBe(false);
    });
  });

  it('calls the project work item query', () => {
    const workItemResponseHandler = jest.fn().mockResolvedValue(workItemByIidResponseFactory());
    createComponent({ workItemResponseHandler });

    expect(workItemResponseHandler).toHaveBeenCalled();
  });

  describe('when edit mode is inactive', () => {
    beforeEach(() => {
      createComponent();
    });

    it('does not show edit mode of markdown editor in default mode', () => {
      expect(findMarkdownEditor().exists()).toBe(false);
    });
  });

  describe('when edit mode is active', () => {
    it('shows markdown editor in edit mode only when the correct props are passed', () => {
      createComponent({ editMode: true });

      expect(findMarkdownEditor().exists()).toBe(true);
    });

    it('emits the `updateDraft` event when the description is updated', () => {
      createComponent({ editMode: true });
      const updatedDesc = 'updated desc with inline editing disabled';

      findMarkdownEditor().vm.$emit('input', updatedDesc);

      expect(wrapper.emitted('updateDraft')).toEqual([[updatedDesc]]);
    });

    it('emits the `updateWorkItem` event when submitting the description', async () => {
      await createComponent({ isEditing: true });
      editDescription('updated description');
      findMarkdownEditor().vm.$emit(
        'keydown',
        new KeyboardEvent('keydown', { key: ENTER_KEY, ctrlKey: true }),
      );

      expect(wrapper.emitted('updateWorkItem')).toEqual([[{ clearDraft: expect.any(Function) }]]);
    });

    describe('when description has conflicts', () => {
      beforeEach(async () => {
        const workItemResponseHandler = jest
          .fn()
          .mockResolvedValueOnce(workItemByIidResponseFactory())
          .mockResolvedValueOnce(
            workItemByIidResponseFactory({
              descriptionText: 'description updated by someone else',
            }),
          );
        await createComponent({ isEditing: true, workItemResponseHandler });

        editDescription('updated description');

        // Trigger a refetch of the work item data
        await wrapper.vm.$apollo.queries.workItem.refetch();
      });

      it('shows conflict warning when description is updated while editing', () => {
        expect(findConflictsAlert().exists()).toBe(true);
        expect(findConflictsAlert().text()).toContain(
          'Someone edited the description at the same time you did',
        );
        expect(findConflictedDescription().attributes('value')).toBe(
          'description updated by someone else',
        );

        expect(findSubmitButton().text()).toBe('Save and overwrite');
        expect(findCancelButton().text()).toBe('Discard changes');
      });

      it('clears conflict warning on save', async () => {
        findSubmitButton().vm.$emit('click');

        await nextTick();

        expect(findConflictsAlert().exists()).toBe(false);
      });
    });

    it('does not show conflict warning when in create flow', async () => {
      const workItemResponseHandler = jest
        .fn()
        .mockResolvedValueOnce(workItemByIidResponseFactory())
        .mockResolvedValueOnce(
          workItemByIidResponseFactory({
            descriptionText: 'description updated by someone else',
          }),
        );
      await createComponent({
        workItemId: newWorkItemId(workItemQueryResponse.data.workItem.workItemType.name),
        isEditing: true,
        workItemResponseHandler,
      });

      editDescription('updated description');

      // Trigger a refetch of the work item data
      await wrapper.vm.$apollo.queries.workItem.refetch();

      expect(findConflictsAlert().exists()).toBe(false);
    });
  });

  describe('checklist count visibility', () => {
    const taskCompletionStatus = {
      completedCount: 0,
      count: 4,
    };

    describe('when checklist exists', () => {
      it('when edit mode is active, checklist count is not visible', async () => {
        await createComponent({
          editMode: true,
          workItemResponse: workItemByIidResponseFactory({ taskCompletionStatus }),
        });

        expect(findEditedAt().exists()).toBe(false);
      });

      it('when edit mode is inactive, checklist count is visible', async () => {
        await createComponent({
          editMode: false,
          workItemResponse: workItemByIidResponseFactory({ taskCompletionStatus }),
        });

        expect(findEditedAt().exists()).toBe(true);
        expect(findEditedAt().props()).toMatchObject({
          taskCompletionStatus,
        });
      });
    });

    describe('when checklist does not exist', () => {
      it('checklist count is not visible', async () => {
        await createComponent({
          workItemResponse: workItemByIidResponseFactory({ taskCompletionStatus: null }),
        });

        expect(findEditedAt().exists()).toBe(false);
      });
    });
  });
});
