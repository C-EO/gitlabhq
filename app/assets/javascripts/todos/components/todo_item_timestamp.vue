<script>
import { isInPast, isToday, newDate } from '~/lib/utils/datetime_utility';
import { formatDate } from '~/lib/utils/datetime/date_format_utility';
import timeagoMixin from '~/vue_shared/mixins/timeago';
import { s__, sprintf } from '~/locale';

export default {
  mixins: [timeagoMixin],
  props: {
    todo: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      isLoading: false,
    };
  },
  computed: {
    dueDate() {
      return newDate(this.todo.targetEntity.dueDate);
    },
    formattedCreatedAt() {
      return this.timeFormatted(this.todo.createdAt);
    },
    formattedDueDate() {
      if (!this.todo?.targetEntity?.dueDate) {
        return null;
      }

      if (isToday(this.dueDate)) {
        return s__('Todos|Due today');
      }

      return sprintf(s__('Todos|Due %{when}'), {
        when: formatDate(this.todo.targetEntity.dueDate, 'mmm dd, yyyy'),
      });
    },
    showDueDateAsError() {
      return this.formattedDueDate && isInPast(this.dueDate);
    },
    showDueDateAsWarning() {
      return this.formattedDueDate && isToday(this.dueDate);
    },
  },
};
</script>

<template>
  <span class="gl-text-sm gl-text-subtle">
    <span
      v-if="formattedDueDate"
      :class="{
        'gl-text-red-500': showDueDateAsError,
        'gl-text-orange-500': showDueDateAsWarning,
      }"
      >{{ formattedDueDate }}</span
    >
    <template v-if="formattedDueDate"> &middot; </template>
    {{ formattedCreatedAt }}
  </span>
</template>
