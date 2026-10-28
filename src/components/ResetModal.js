import { ref, watch, nextTick } from 'vue';
import { activePeople, placeDocs, resetAll, say } from '../store.js';

export default {
  name: 'ResetModal',
  props: { open: Boolean },
  emits: ['close'],
  setup(props, { emit }) {
    const text = ref('');
    const busy = ref(false);
    const input = ref(null);
    watch(() => props.open, async (o) => {
      text.value = '';
      if (o) { await nextTick(); input.value && input.value.focus(); }
    });
    function close() { if (!busy.value) emit('close'); }
    async function confirm() {
      busy.value = true;
      try { await resetAll(); emit('close'); } catch (e) { console.error(e); say('ล้างข้อมูลไม่สำเร็จ ลองอีกครั้ง'); }
      busy.value = false;
    }
    return { text, busy, input, close, confirm, activePeople, placeDocs };
  },
  template: `
  <div class="backdrop" v-if="open" @click.self="close" @keydown.esc="close">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="rtitle">
      <h3 id="rtitle">ล้างข้อมูลทั้งหมด?</h3>
      <div class="warnbox">วันว่างของ {{ activePeople.length }} คน, สถานที่ {{ placeDocs.length }} ที่ และโหวตทั้งหมดจะถูกลบ และกู้คืนไม่ได้</div>
      <form @submit.prevent="text.trim()==='ล้าง' && confirm()">
        <div class="field mt">
          <label class="label" for="rconfirm">พิมพ์คำว่า “ล้าง” เพื่อยืนยัน</label>
          <input id="rconfirm" ref="input" v-model="text" autocomplete="off">
        </div>
        <div class="acts">
          <button class="btn" type="button" @click="close">ยกเลิก</button>
          <button class="btn danger" type="submit" :disabled="text.trim() !== 'ล้าง' || busy">{{ busy ? 'กำลังล้าง…' : 'ล้างทั้งหมด' }}</button>
        </div>
      </form>
    </div>
  </div>`,
};
