import { ref, nextTick } from 'vue';

// A page heading that hosts can rename in place. Emits `save` with the trimmed new name.
export default {
  name: 'EditableTitle',
  props: {
    value: { type: String, required: true },
    canEdit: Boolean,
    max: { type: Number, default: 40 },
    label: { type: String, default: 'ชื่อ' }, // e.g. "ชื่อแก๊ง", used for the button and input labels
    size: { type: String, default: '' },
  },
  emits: ['save'],
  setup(props, { emit }) {
    const editing = ref(false);
    const draft = ref('');
    const input = ref(null);
    async function start() {
      draft.value = props.value;
      editing.value = true;
      await nextTick();
      input.value && input.value.select();
    }
    function save() {
      const v = draft.value.replace(/\s+/g, ' ').trim().slice(0, props.max);
      editing.value = false;
      if (v && v !== props.value) emit('save', v);
    }
    return { editing, draft, input, start, save };
  },
  template: /* html */ `
    <form v-if="editing" class="row" style="gap: 8px" @submit.prevent="save" @keydown.esc="editing = false">
      <input ref="input" class="input grow" v-model="draft" :maxlength="max" :aria-label="label" required>
      <button class="btn primary sm" type="submit">บันทึก</button>
      <button class="btn ghost sm" type="button" @click="editing = false">ยกเลิก</button>
    </form>
    <div v-else class="row" style="gap: 4px; align-items: center">
      <h1 :style="size ? 'font-size: ' + size : ''">{{ value }}</h1>
      <button v-if="canEdit" class="icon-btn" type="button" :aria-label="'แก้' + label" :title="'แก้' + label" @click="start">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"></path><path d="M13.5 6.5l4 4"></path></svg>
      </button>
    </div>
  `,
};
