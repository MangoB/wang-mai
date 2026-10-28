import { reactive, ref } from 'vue';
import { parseMap, embedUrl, cleanUrl } from '../lib/maps.js';
import {
  me, meKey, placesSorted, addPlace, removePlace, toggleVote, normName,
} from '../store.js';

export default {
  name: 'PlacesBoard',
  setup() {
    const form = reactive({ title: '', url: '', note: '' });
    const error = ref('');
    const busy = ref(false);
    const confirmId = ref('');

    async function submit() {
      error.value = '';
      const url = cleanUrl(form.url);
      if (url === null) { error.value = 'ลิงก์ไม่ถูกต้อง ลองคัดลอกจากปุ่ม "แชร์" ใน Google Maps อีกครั้ง'; return; }
      const title = normName(form.title) || parseMap(url).name;
      if (!title) { error.value = 'ใส่ชื่อสถานที่ หรือแปะลิงก์ที่มีชื่อสถานที่อยู่'; return; }
      busy.value = true;
      const ok = await addPlace({ title, url, note: form.note.trim() });
      busy.value = false;
      if (ok) { form.title = ''; form.url = ''; form.note = ''; }
    }
    async function remove(p) {
      if (confirmId.value !== p.id) { confirmId.value = p.id; return; }
      confirmId.value = '';
      await removePlace(p);
    }

    return { form, error, busy, submit, me, meKey, placesSorted, toggleVote, embedUrl, remove, confirmId };
  },
  template: `
  <section class="board">
    <h2>สถานที่นัด</h2>
    <p class="sub">แปะลิงก์ Google Maps ให้เพื่อนกดเข้าไปดู แล้วโหวตที่ที่อยากไป</p>
    <form class="pform" @submit.prevent="submit">
      <div class="field"><label class="label" for="ptitle">ชื่อที่</label>
        <input id="ptitle" v-model="form.title" maxlength="80" placeholder="เช่น หมูกระทะ ลาดพร้าว 71"></div>
      <div class="field"><label class="label" for="purl">ลิงก์ Google Maps</label>
        <input id="purl" v-model="form.url" maxlength="500" inputmode="url" placeholder="https://maps.app.goo.gl/…"></div>
      <div class="field full"><label class="label" for="pnote">โน้ต (ไม่บังคับ)</label>
        <textarea id="pnote" v-model="form.note" maxlength="300" placeholder="ที่จอดรถ ราคาประมาณ ต้องจองก่อนไหม"></textarea></div>
      <div class="full row between">
        <p class="err" v-if="error">{{ error }}</p><span v-else></span>
        <button class="btn primary" type="submit" :disabled="busy">{{ busy ? 'กำลังเพิ่ม…' : 'เพิ่มสถานที่' }}</button>
      </div>
    </form>

    <div class="pgrid" v-if="placesSorted.length">
      <article class="place" v-for="(p,i) in placesSorted" :key="p.id" :class="{lead: i===0 && p.votes.length}">
        <div class="mapbox">
          <iframe v-if="embedUrl(p)" :src="embedUrl(p)" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
            :title="'แผนที่ ' + p.title" allowfullscreen></iframe>
        </div>
        <div class="pbody">
          <h3>{{ p.title }}</h3>
          <p v-if="p.note">{{ p.note }}</p>
          <div class="pmeta">เสนอโดย {{ p.by }}<template v-if="p.votes.length"> · โหวต: {{ p.votes.join(', ') }}</template></div>
          <a v-if="p.url" class="maplink" :href="p.url" target="_blank" rel="noopener noreferrer">เปิดใน Google Maps ↗</a>
        </div>
        <div class="pfoot">
          <button class="vote" :class="{on: me.votePlaces.includes(p.id)}" :aria-pressed="me.votePlaces.includes(p.id)"
            @click="toggleVote('votePlaces', p.id)">
            {{ me.votePlaces.includes(p.id) ? 'โหวตแล้ว' : 'โหวต' }} <span class="k">{{ p.votes.length }}</span>
          </button>
          <button class="btn ghost sm" v-if="p.byKey === meKey" @click="remove(p)" @blur="confirmId=''">
            {{ confirmId === p.id ? 'กดอีกครั้งเพื่อลบ' : 'ลบ' }}
          </button>
        </div>
      </article>
    </div>
    <div class="empty mt" v-else>ยังไม่มีสถานที่ เพิ่มที่แรกจากฟอร์มด้านบน</div>
  </section>`,
};
