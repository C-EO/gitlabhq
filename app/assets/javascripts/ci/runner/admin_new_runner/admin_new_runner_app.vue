<script>
import { createAlert, VARIANT_SUCCESS } from '~/alert';
import { visitUrl } from '~/lib/utils/url_utility';
import { s__ } from '~/locale';

import glFeatureFlagsMixin from '~/vue_shared/mixins/gl_feature_flags_mixin';
import PageHeading from '~/vue_shared/components/page_heading.vue';
import RunnerCreateForm from '~/ci/runner/components/runner_create_form.vue';
import RunnerCreateWizard from '~/ci/runner/components/runner_create_wizard.vue';
import { INSTANCE_TYPE } from '../constants';
import { saveAlertToLocalStorage } from '../local_storage_alert/save_alert_to_local_storage';

export default {
  name: 'AdminNewRunnerApp',
  components: {
    RunnerCreateForm,
    RunnerCreateWizard,
    PageHeading,
  },
  mixins: [glFeatureFlagsMixin()],
  props: {
    runnersPath: {
      type: String,
      required: true,
    },
  },
  methods: {
    onSaved(runner) {
      saveAlertToLocalStorage({
        message: s__('Runners|Runner created.'),
        variant: VARIANT_SUCCESS,
      });
      visitUrl(runner.ephemeralRegisterUrl);
    },
    onError(error) {
      createAlert({ message: error.message });
    },
  },
  INSTANCE_TYPE,
};
</script>

<template>
  <runner-create-wizard
    v-if="glFeatures.runnerCreateWizardAdmin"
    :runner-type="$options.INSTANCE_TYPE"
    :runners-path="runnersPath"
  />
  <div v-else>
    <page-heading :heading="s__('Runners|Create instance runner')">
      <template #description>
        {{
          s__(
            'Runners|Create an instance runner to generate a command that registers the runner with all its configurations.',
          )
        }}
      </template>
    </page-heading>
    <runner-create-form :runner-type="$options.INSTANCE_TYPE" @saved="onSaved" @error="onError" />
  </div>
</template>
