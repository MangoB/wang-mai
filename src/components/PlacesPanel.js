import { reactive, ref } from 'vue';
import { parseMap, embedUrl, cleanUrl } from '../lib/maps.js';
import {
  placesRanked, mine, myMember, canRun, isOpen, toggleVote, addPlace, removePlace, personByPid, meetPeople, say, explain,
} from '../store.js';
import { chipStyle } from '../lib/palette.js';

const CROWN = 'M3 18h18l-1.6-10-4.9 4.2L12 5l-2.5 7.2L4.6 8z';

export default {
  name: 'PlacesPanel',
  setup() {
    const form = reactive({ title: '', url: '', note: '' });
    const error = ref('');
    const busy = ref(false);
    const confirmId = ref('');

    async function submit() {
      error.value = '';
      let url = cleanUrl(form.url);
      if (url === null) { error.value = 'ลิงก์ไม่ถูกต้อง ลองคัดลอกจากปุ่ม "แชร์" ใน Google Maps'; return; }
      if (url && url.startsWith('http://')) url = 'https://' + url.slice(7);
      const title = form.title.replace(/\s+/g, ' ').trim() || parseMap(url).name;
      if (!title) { error.value = 'ใส่ชื่อสถานที่ หรือแปะลิงก์ที่มีชื่อร้าน'; return; }
      busy.value = true;
      try {
        await addPlace({ title: title.slice(0, 80), mapsUrl: url, note: form.note.trim().slice(0, 300) });
        form.title = ''; form.url = ''; form.note = '';
      } catch (e) { error.value = explain(e); }
      busy.value = false;
    }

    async function remove(pl) {
      if (confirmId.value !== pl.id) { confirmId.value = pl.id; return; }
      confirmId.value = '';
      try { await removePlace(pl); say('ลบ ' + pl.title + ' แล้ว'); } catch (e) { say(explain(e), 'error'); }
    }

    const canRemove = (pl) => isOpen.value && myMember.value && (pl.pid === myMember.value.pid || canRun.value);
    const byName = (pid) => (personByPid.value.get(pid) || {}).name || 'ใครสักคน';

    return {
      CROWN, form, error, busy, submit, remove, confirmId, placesRanked, mine, isOpen, toggleVote, embedUrl, chipStyle, canRemove, byName, meetPeople,
    };
  },
  template: /* html */ `
  <section class="stack" style="gap: 12px">
    <form v-if="isOpen" class="sheet" @submit.prevent="submit">
      <h2>เสนอสถานที่</h2>
      <div class="field"><label for="pt">ชื่อสถานที่</label><input id="pt" class="input" v-model="form.title" maxlength="80" placeholder="เช่น หมูกระทะ ลาดพร้าว 71"></div>
      <div class="field"><label for="pu">ลิงก์ Google Maps</label><input id="pu" class="input" v-model="form.url" maxlength="500" inputmode="url" placeholder="https://maps.app.goo.gl/…"></div>
      <div class="field"><label for="pn">โน้ต <span class="muted small">(ไม่บังคับ)</span></label><textarea id="pn" class="input" v-model="form.note" maxlength="300" placeholder="ที่จอดรถ ราคาประมาณ ต้องจองก่อนไหม"></textarea></div>
      <p class="err" v-if="error">{{ error }}</p>
      <button class="btn primary" type="submit" :disabled="busy">{{ busy ? 'กำลังเพิ่ม…' : 'เพิ่มสถานที่' }}</button>
    </form>

    <div class="places" v-if="placesRanked.length">
      <article v-for="pl in placesRanked" :key="pl.id" class="place" :class="{ gold: pl.gold }">
        <div class="map"><iframe v-if="embedUrl({ url: pl.mapsUrl, title: pl.title })" :src="embedUrl({ url: pl.mapsUrl, title: pl.title })" loading="lazy" referrerpolicy="no-referrer-when-downgrade" :title="'แผนที่ ' + pl.title"></iframe></div>
        <div class="body">
          <div class="row between">
            <h3 style="font-size: 17px; font-weight: 600" class="grow">{{ pl.title }}</h3>
            <span v-if="pl.gold" class="tag" style="background: var(--gold-soft); color: var(--gold-ink); display: inline-flex; gap: 4px; align-items: center">
              <svg class="crown" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path :d="CROWN"></path></svg>ทุกคนโหวต
            </span>
          </div>
          <p v-if="pl.note" style="margin: 0; font-size: 14px; white-space: pre-line">{{ pl.note }}</p>
          <p class="small muted" style="margin: 0">เสนอโดย {{ byName(pl.pid) }}</p>
          <a v-if="pl.mapsUrl" :href="pl.mapsUrl" target="_blank" rel="noopener noreferrer" class="small" style="font-weight: 600">เปิดใน Google Maps</a>
        </div>
        <div class="foot">
          <span class="row" style="gap: 6px">
            <span class="chips"><span v-for="p in pl.votes" :key="p.pid" class="sq" style="width: 12px; height: 12px" :style="{ background: chipStyle(p.color).background }"></span></span>
            <span class="small muted">{{ pl.votes.length }} โหวต</span>
          </span>
          <span class="row">
            <button v-if="canRemove(pl)" class="btn sm ghost" @click="remove(pl)" @blur="confirmId = ''">{{ confirmId === pl.id ? 'กดอีกครั้งเพื่อลบ' : 'ลบ' }}</button>
            <span v-if="isOpen && mine.votePlaces.includes(pl.id)" class="voted"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg> โหวตแล้ว</span>
            <button v-if="isOpen" class="vote" :aria-pressed="mine.votePlaces.includes(pl.id)" :aria-label="(mine.votePlaces.includes(pl.id) ? 'ยกเลิกโหวต ' : 'โหวต ') + pl.title" @click="toggleVote('votePlaces', pl.id)">{{ mine.votePlaces.includes(pl.id) ? 'ยกเลิกโหวต' : 'โหวต' }}</button>
          </span>
        </div>
      </article>
    </div>
    <p class="muted small" v-else>ยังไม่มีสถานที่<span v-if="isOpen"> เพิ่มสถานที่แรกจากฟอร์มด้านบน</span></p>
  </section>`,
};
