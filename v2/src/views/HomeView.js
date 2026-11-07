import { ref, watch } from 'vue';
import {
  session, isGoogle, saveProfile, createRoom, joinWithRoomCode, joinWithGuestCode, localRooms, myRooms, loadMyRooms, say, explain,
} from '../store.js';
import { COLORS } from '../lib/palette.js';
import { cleanCode } from '../lib/codes.js';

export default {
  name: 'HomeView',
  setup() {
    // ----- profile (Google members) -----
    const name = ref('');
    const color = ref(7);
    const savingProfile = ref(false);
    watch(() => session.profile, (p) => { if (p) { name.value = p.name; color.value = p.color; } }, { immediate: true });
    async function submitProfile() {
      const n = name.value.replace(/\s+/g, ' ').trim();
      if (!n) { say('ใส่ชื่อก่อน', 'error'); return; }
      savingProfile.value = true;
      try { await saveProfile(n.slice(0, 30), color.value); say('บันทึกแล้ว'); } catch (e) { say(explain(e), 'error'); }
      savingProfile.value = false;
    }

    watch(() => session.profile && session.profile.rooms && session.profile.rooms.join(','), () => { if (isGoogle.value && session.profile) loadMyRooms(); }, { immediate: true });

    // ----- create room -----
    const roomName = ref('');
    const creating = ref(false);
    async function submitRoom() {
      const n = roomName.value.trim();
      if (!n) return;
      creating.value = true;
      try { const id = await createRoom(n.slice(0, 40)); location.hash = '#r-' + id; } catch (e) { say(explain(e), 'error'); }
      creating.value = false;
    }

    // ----- join -----
    const code = ref('');
    const guestCode = ref('');
    const joinError = ref('');
    const joining = ref(false);
    async function submitJoin() {
      joinError.value = '';
      joining.value = true;
      try {
        const rc = cleanCode(code.value);
        const gc = cleanCode(guestCode.value);
        if (!gc && !isGoogle.value) throw new Error('ใส่รหัสส่วนตัวด้วย หรือออกจากระบบแล้วเข้าด้วย Google');
        const id = gc ? await joinWithGuestCode(rc, gc) : await joinWithRoomCode(rc);
        location.hash = '#r-' + id;
      } catch (e) { joinError.value = e.code ? explain(e) : e.message; }
      joining.value = false;
    }

    return {
      session, isGoogle, COLORS, name, color, savingProfile, submitProfile,
      roomName, creating, submitRoom, code, guestCode, joinError, joining, submitJoin, localRooms, myRooms,
    };
  },
  template: /* html */ `
  <section class="stack" style="gap: 18px">
    <!-- first visit as a Google member: pick a name and a colour -->
    <form v-if="isGoogle && session.profileLoaded && !session.profile" class="sheet outlined" @submit.prevent="submitProfile">
      <h1>ตั้งชื่อกับสีของคุณ</h1>
      <p class="muted" style="margin: 0">เพื่อนจะเห็นชื่อนี้ และสติกเกอร์สีนี้บนปฏิทิน ถ้าในห้องมีคนใช้สีนี้แล้ว ระบบจะเลือกสีที่ว่างให้ และเปลี่ยนเองได้ที่หน้าสมาชิก</p>
      <div class="field"><label for="pname">ชื่อ</label><input id="pname" class="input" v-model="name" maxlength="30" autocomplete="nickname"></div>
      <div class="field">
        <span style="font-size: 14px; font-weight: 600">สีประจำตัว</span>
        <div class="swatches">
          <button v-for="(c, i) in COLORS" :key="i" type="button" class="swatch" :style="{ background: c.hex }" :aria-label="c.name" :aria-pressed="color === i" @click="color = i"></button>
        </div>
      </div>
      <button class="btn primary" type="submit" :disabled="savingProfile">เริ่มใช้งาน</button>
    </form>

    <template v-else>
      <div>
        <h1>ห้องของคุณ</h1>
        <p class="muted" style="margin: 4px 0 0" v-if="isGoogle">สร้างห้องให้แก๊ง หรือเข้าห้องเพื่อนด้วยรหัส</p>
      </div>

      <div class="list">
        <template v-if="isGoogle">
          <a v-for="r in myRooms.list" :key="r.id" class="item" :href="'#r-' + r.id">
            <span class="grow"><b>{{ r.name }}</b></span>
            <span class="tag" v-if="r.ownerUid === session.user.uid">เจ้าของ</span>
          </a>
          <p class="muted small" v-if="!myRooms.loading && !myRooms.list.length">ยังไม่มีห้อง สร้างห้องแรกด้านล่าง หรือใส่รหัสห้องของเพื่อน</p>
        </template>
        <a v-for="r in localRooms" :key="r.roomId" class="item" :href="'#r-' + r.roomId">
          <span class="grow"><b>{{ r.name || 'ห้องที่เคยเข้า' }}</b><br><span class="small muted" v-if="r.as">ในชื่อ {{ r.as }}</span></span>
        </a>
      </div>

      <div class="meet-grid" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))">
        <form v-if="isGoogle" class="sheet" @submit.prevent="submitRoom">
          <h2>สร้างห้องใหม่</h2>
          <div class="field"><label for="rname">ชื่อห้อง</label><input id="rname" class="input" v-model="roomName" maxlength="40" placeholder="เช่น แก๊งมหาลัย"></div>
          <button class="btn primary" type="submit" :disabled="creating || !roomName.trim() || (session.profile && session.profile.roomCount >= 5)">
            {{ session.profile && session.profile.roomCount >= 5 ? 'สร้างครบ 5 ห้องแล้ว' : 'สร้างห้อง' }}
          </button>
        </form>
        <form class="sheet" @submit.prevent="submitJoin">
          <h2>เข้าห้องเพื่อน</h2>
          <div class="field"><label for="jcode">รหัสห้อง</label><input id="jcode" class="input code" v-model="code" maxlength="7" autocomplete="off" placeholder="K7Q-X2M"></div>
          <div class="field">
            <label for="jguest">รหัสส่วนตัว <span class="muted small">(ถ้ามี)</span></label>
            <input id="jguest" class="input code" v-model="guestCode" maxlength="9" autocomplete="off" placeholder="HX4P-9KTW">
          </div>
          <p class="err" v-if="joinError">{{ joinError }}</p>
          <button class="btn" type="submit" :disabled="joining">เข้าห้อง</button>
        </form>
      </div>
    </template>
  </section>`,
};
