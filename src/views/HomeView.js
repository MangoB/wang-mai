import { ref, computed, watch } from 'vue';
import {
  session, isGoogle, createRoom, localRooms, home, loadHome, recentMeetups, pendingGang, setPendingGang,
  ROLE_LABEL, say, explain,
} from '../store.js';
import { chipStyle } from '../lib/palette.js';
import { cleanCode } from '../lib/codes.js';
import { fmtShort } from '../lib/dates.js';
import ProfileForm from '../components/ProfileForm.js';
import AskSheet from '../components/AskSheet.js';

const MAX_GANGS = 5;

export default {
  name: 'HomeView',
  components: { ProfileForm, AskSheet },
  setup() {
    const needsProfile = computed(() => isGoogle.value && session.profileLoaded && !session.profile);
    watch(() => [session.user && session.user.uid, session.profile && (session.profile.rooms || []).join(','), localRooms.value.length],
      () => { if (session.user && !needsProfile.value) loadHome(); }, { immediate: true });

    // ----- ถามว่าว่างไหม? -----
    const asking = ref(false);
    const askable = computed(() => home.gangs.filter((g) => !g.guestOf).map((g) => ({ id: g.id, name: g.name })));

    // ----- สร้างแก๊งใหม่ -----
    const creating = ref(false);
    const gangName = ref('');
    const busy = ref(false);
    const left = computed(() => MAX_GANGS - ((session.profile && session.profile.roomCount) || 0));
    async function create() {
      const n = gangName.value.replace(/\s+/g, ' ').trim();
      if (!n) return;
      busy.value = true;
      try { const id = await createRoom(n.slice(0, 40)); location.hash = '#r-' + id; } catch (e) { say(explain(e), 'error'); }
      busy.value = false;
    }

    // ----- รหัสแก๊งจากเพื่อน -----
    const code = ref('');
    async function join() {
      const c = cleanCode(code.value);
      if (c.length !== 6) { say('รหัสแก๊งมี 6 ตัว', 'error'); return; }
      location.hash = '#g-' + c;
    }

    const summary = (m) => {
      const r = m.result || {};
      return [r.date ? '📅 ' + fmtShort(r.date) : '', r.placeTitle ? '📍 ' + r.placeTitle : ''].filter(Boolean);
    };
    const gangOf = (g) => g.gang.slice(0, 8);

    return {
      session, isGoogle, needsProfile, home, recentMeetups, pendingGang, setPendingGang, asking, askable,
      creating, gangName, busy, left, create, code, join, summary, gangOf, chipStyle, ROLE_LABEL,
    };
  },
  template: /* html */ `
  <section class="stack" style="gap: 18px">
    <ProfileForm v-if="needsProfile" />

    <template v-else>
      <button v-if="askable.length" class="row between" style="border: 0; cursor: pointer; text-align: left; padding: 16px 18px; border-radius: 20px; background: var(--ink); color: var(--on-ink)" @click="asking = true">
        <span class="display" style="font-size: 24px">ถามว่าว่างไหม?</span>
        <span style="width: 44px; height: 44px; border-radius: 14px; background: var(--gold-bright); color: var(--ink-fixed); display: grid; place-items: center" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg>
        </span>
      </button>

      <div v-if="pendingGang" class="sheet outlined row" style="flex-direction: row; align-items: center">
        <span class="grow"><b>{{ pendingGang.name || 'แก๊งเพื่อน' }}</b> ชวนคุณเข้าแก๊ง</span>
        <a class="btn sm primary" :href="'#g-' + pendingGang.code">รับ</a>
        <button class="btn sm" @click="setPendingGang(null)">ไม่รับ</button>
      </div>

      <section v-if="recentMeetups.length" class="stack" aria-labelledby="recent-h">
        <h2 id="recent-h" class="small muted" style="font-size: 15px">นัดล่าสุด</h2>
        <a v-for="m in recentMeetups" :key="m.gangId + m.id" class="sheet" :href="'#m-' + m.gangId + '-' + m.id" style="text-decoration: none; color: inherit; gap: 8px">
          <span class="row between"><b style="font-size: 17px">{{ m.title }}</b><span class="small muted">{{ m.gangName }}</span></span>
          <span class="row">
            <span v-for="t in summary(m)" :key="t" class="tag" style="background: var(--gold-soft); color: var(--gold-ink)">{{ t }}</span>
            <span v-if="!summary(m).length" class="small muted">ยังไม่ได้สรุปวันหรือสถานที่</span>
          </span>
        </a>
      </section>

      <section class="stack" aria-labelledby="gangs-h">
        <h2 id="gangs-h" class="small muted" style="font-size: 15px">แก๊งของฉัน</h2>
        <p v-if="home.loading && !home.loaded" class="muted small" style="margin: 0">กำลังโหลด…</p>
        <a v-for="g in home.gangs" :key="g.id" class="sheet row" :href="'#r-' + g.id" style="text-decoration: none; color: inherit; flex-direction: row; flex-wrap: nowrap; align-items: center">
          <span class="grow stack" style="gap: 6px">
            <b style="font-size: 17px">{{ g.name }}</b>
            <span class="chips"><span v-for="p in gangOf(g)" :key="p.pid" class="chip" :style="chipStyle(p.color)">{{ p.name.charAt(0) }}</span></span>
          </span>
          <span class="tag">{{ g.guestOf ? 'แขก' : ROLE_LABEL[g.role] }}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" class="muted" style="flex: none"><path d="M9 6l6 6-6 6"></path></svg>
        </a>
        <p v-if="home.loaded && !home.gangs.length" class="muted small" style="margin: 0">
          {{ isGoogle ? 'ยังไม่มีแก๊ง สร้างแก๊งแรกได้เลย หรือกดลิงก์แก๊งที่เพื่อนส่งมา' : 'ยังไม่มีแก๊ง กดลิงก์ที่เพื่อนส่งมาเพื่อเข้าแก๊ง' }}
        </p>

        <template v-if="isGoogle && session.profile">
          <button v-if="!creating" class="row" style="border: 1.5px dashed var(--ink-2); border-radius: var(--r-sheet); background: transparent; padding: 14px 16px; cursor: pointer; text-align: left" :disabled="left <= 0" @click="creating = true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>
            <span class="grow"><b>สร้างแก๊งใหม่</b> <span class="small muted">· {{ left > 0 ? 'สร้างได้อีก ' + left + ' แก๊ง' : 'สร้างครบ 5 แก๊งแล้ว' }}</span></span>
          </button>
          <form v-else class="sheet" @submit.prevent="create">
            <div class="field"><label for="gname">ชื่อแก๊ง</label><input id="gname" class="input" v-model="gangName" maxlength="40" placeholder="เช่น แก๊งมหาลัย" autofocus></div>
            <div class="row" style="justify-content: flex-end">
              <button type="button" class="btn" @click="creating = false">ยกเลิก</button>
              <button type="submit" class="btn primary" :disabled="busy || !gangName.trim()">สร้างแก๊ง</button>
            </div>
          </form>
        </template>
      </section>

      <form v-if="isGoogle && session.profile" class="stack" style="gap: 8px; padding: 14px; border-radius: var(--r-sheet); background: var(--sunk)" @submit.prevent="join">
        <b class="small">เพื่อนชวนเข้าแก๊ง?</b>
        <span class="small muted">กดลิงก์ที่เพื่อนส่งมาได้เลย หรือพิมพ์รหัสแก๊ง</span>
        <div class="row">
          <input class="input code grow" v-model="code" maxlength="7" autocomplete="off" autocapitalize="characters" placeholder="K7Q-X2M" aria-label="รหัสแก๊ง">
          <button class="btn" type="submit">เข้าแก๊ง</button>
        </div>
      </form>
    </template>

    <AskSheet v-if="asking" :gangs="askable" @close="asking = false" />
  </section>`,
};
