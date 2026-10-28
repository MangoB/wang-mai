import { ref } from 'vue';
import { activePeople, pickProfile, createProfile } from '../store.js';

export default {
  name: 'ProfileGate',
  setup() {
    const newName = ref('');
    const error = ref('');
    function submit() {
      error.value = createProfile(newName.value);
      if (!error.value) newName.value = '';
    }
    return { activePeople, pickProfile, newName, error, submit };
  },
  template: `
  <section class="board gate">
    <h2>คุณคือใคร?</h2>
    <p class="sub">พิมพ์แค่ชื่อพอ ไม่ต้องมีรหัส ชื่อที่ลงข้อมูลไว้แล้วจะเลือกกลับมาใช้ต่อได้</p>
    <div class="gate-grid">
      <div>
        <div class="label mb">ใช้ชื่อเดิม</div>
        <div class="chips" v-if="activePeople.length">
          <button class="chip" v-for="p in activePeople" :key="p.key" @click="pickProfile(p)">
            {{ p.name }}<small>{{ p.dates.length }} วัน</small>
          </button>
        </div>
        <p class="hint" v-else>ยังไม่มีใครลงข้อมูลในรอบนี้</p>
      </div>
      <form @submit.prevent="submit">
        <label class="label mb" for="newname">เริ่มด้วยชื่อใหม่</label>
        <div class="row">
          <div class="field">
            <input id="newname" v-model="newName" maxlength="30" placeholder="เช่น ต้น, Mild" autocomplete="nickname">
          </div>
          <button class="btn primary" type="submit">เริ่มเลย</button>
        </div>
        <p class="err mt" v-if="error">{{ error }}</p>
      </form>
    </div>
  </section>`,
};
