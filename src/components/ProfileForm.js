import { ref, watch } from 'vue';
import { session, saveProfile, say, explain } from '../store.js';
import { COLORS } from '../lib/palette.js';

// First sign-in with Google: pick the name and colour friends will see. Emits `saved`.
export default {
  name: 'ProfileForm',
  props: { title: { type: String, default: 'ตั้งชื่อกับสีของคุณ' } },
  emits: ['saved'],
  setup(props, { emit }) {
    const name = ref((session.user && session.user.displayName || '').split(' ')[0].slice(0, 30));
    const color = ref(7);
    const busy = ref(false);
    watch(() => session.profile, (p) => { if (p) { name.value = p.name; color.value = p.color; } }, { immediate: true });
    async function submit() {
      const n = name.value.replace(/\s+/g, ' ').trim();
      if (!n) { say('ใส่ชื่อก่อน', 'error'); return; }
      busy.value = true;
      try { await saveProfile(n.slice(0, 30), color.value); emit('saved'); } catch (e) { say(explain(e), 'error'); }
      busy.value = false;
    }
    return { COLORS, name, color, busy, submit };
  },
  template: /* html */ `
  <form class="sheet outlined" @submit.prevent="submit">
    <h2 class="display" style="font-size: 22px">{{ title }}</h2>
    <p class="muted small" style="margin: 0">เพื่อนจะเห็นชื่อนี้ และสติกเกอร์สีนี้บนปฏิทิน ถ้าในแก๊งมีคนใช้สีนี้แล้ว ระบบจะเลือกสีที่ว่างให้</p>
    <div class="field"><label for="pname">ชื่อ</label><input id="pname" class="input" v-model="name" maxlength="30" autocomplete="nickname"></div>
    <div class="field">
      <span style="font-size: 14px; font-weight: 600">สีประจำตัว</span>
      <div class="swatches">
        <button v-for="(c, i) in COLORS" :key="i" type="button" class="swatch" :style="{ background: c.hex }" :aria-label="c.name" :aria-pressed="color === i" @click="color = i"></button>
      </div>
    </div>
    <button class="btn primary" type="submit" :disabled="busy">บันทึก</button>
  </form>`,
};
