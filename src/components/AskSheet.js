import { ref, computed } from 'vue';
import { createMeetup, askedMeetup, say, explain } from '../store.js';
import { MSHORT } from '../lib/dates.js';

// "ถามว่าว่างไหม?": start a meetup in one of my gangs, then land on it with "ส่งให้เพื่อน" open.
export default {
  name: 'AskSheet',
  props: {
    gangs: { type: Array, required: true }, // [{ id, name }] where I am in the gang
    preset: { type: String, default: '' },
  },
  emits: ['close'],
  setup(props, { emit }) {
    const gangId = ref(props.preset || (props.gangs[0] && props.gangs[0].id) || '');
    const title = ref('');
    const busy = ref(false);
    const d = new Date();
    const fallback = 'นัดใหม่ ' + d.getDate() + ' ' + MSHORT[d.getMonth()];
    const picked = computed(() => props.gangs.find((g) => g.id === gangId.value));

    async function submit() {
      if (!gangId.value) return;
      busy.value = true;
      try {
        const t = title.value.replace(/\s+/g, ' ').trim().slice(0, 60) || fallback;
        const id = await createMeetup(gangId.value, t);
        askedMeetup.value = id;
        emit('close');
        location.hash = '#m-' + gangId.value + '-' + id;
      } catch (e) { say(explain(e), 'error'); }
      busy.value = false;
    }
    return { gangId, title, busy, fallback, picked, submit };
  },
  template: /* html */ `
  <div class="backdrop" @click.self="$emit('close')">
    <form class="modal" role="dialog" aria-modal="true" aria-labelledby="ask-title" @submit.prevent="submit">
      <h2 id="ask-title" class="display" style="font-size: 24px">ถามว่าว่างไหม?</h2>
      <p class="muted small" style="margin: -8px 0 0">เริ่มนัดใหม่ แล้วส่งข้อความถามเพื่อนได้ทันที</p>
      <div class="field" v-if="gangs.length > 1">
        <span style="font-size: 14px; font-weight: 600">แก๊ง</span>
        <div class="row">
          <button v-for="g in gangs" :key="g.id" type="button" class="btn sm" :class="{ primary: g.id === gangId }" :aria-pressed="g.id === gangId" @click="gangId = g.id">{{ g.name }}</button>
        </div>
      </div>
      <p v-else-if="picked" class="small" style="margin: 0">ในแก๊ง <b>{{ picked.name }}</b></p>
      <div class="field">
        <label for="ask-name">ชื่อนัด</label>
        <input id="ask-name" class="input" v-model="title" maxlength="60" :placeholder="'เช่น ข้าวเย็นปลายปี'">
        <span class="small muted">ไม่ใส่ก็ได้ ระบบตั้งให้ว่า "{{ fallback }}"</span>
      </div>
      <div class="row" style="justify-content: flex-end">
        <button type="button" class="btn" @click="$emit('close')">ยกเลิก</button>
        <button type="submit" class="btn primary" :disabled="busy || !gangId">{{ busy ? 'กำลังสร้าง…' : 'ถามเลย' }}</button>
      </div>
    </form>
  </div>`,
};
