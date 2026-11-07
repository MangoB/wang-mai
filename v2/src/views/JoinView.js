import { ref, onMounted } from 'vue';
import { joinWithGuestCode, signInGoogle, session, say, explain } from '../store.js';
import { cleanCode } from '../lib/codes.js';

export default {
  name: 'JoinView',
  props: { roomCode: String, guestCode: String },
  setup(props) {
    const room = ref(props.roomCode || '');
    const guest = ref(props.guestCode || '');
    const busy = ref(false);
    const error = ref('');

    async function join() {
      error.value = '';
      const rc = cleanCode(room.value);
      const gc = cleanCode(guest.value);
      if (!gc) { error.value = 'ไม่มีรหัสส่วนตัว? เข้าด้วย Google แล้วใส่รหัสห้องได้'; return; }
      busy.value = true;
      try {
        const roomId = await joinWithGuestCode(rc, gc);
        say('เข้าห้องแล้ว');
        location.hash = '#r-' + roomId;
      } catch (e) {
        error.value = e.code ? explain(e) : e.message;
      }
      busy.value = false;
    }

    async function google() {
      await signInGoogle();
      if (session.user && !session.user.isAnonymous) location.hash = '';
    }

    // An invite link carries both codes: join straight away.
    onMounted(() => { if (props.roomCode && props.guestCode) join(); });

    return { room, guest, busy, error, join, google };
  },
  template: /* html */ `
  <section class="stack" style="gap: 28px; padding-top: 32px">
    <div class="stack" style="gap: 14px">
      <div class="logo" aria-hidden="true">
        <span style="background:#E5484D"></span><span style="background:#3E63DD"></span><span style="background:#30A46C"></span><span style="background:#D6409F"></span>
        <span style="background:#F5B100"></span><span style="background:#8E4EC6"></span><span style="background:#0091D5"></span><span style="background:#F76B15"></span>
      </div>
      <h1 style="font-size: 44px; line-height: 1">ว่างไหม</h1>
      <p class="muted" style="margin: 0; max-width: 32ch">แปะวันว่างของแต่ละคน แล้วดูว่าวันไหนว่างกันครบแก๊ง</p>
    </div>

    <form class="sheet" @submit.prevent="join">
      <h2>มีรหัสจากเพื่อน</h2>
      <div class="field">
        <label for="roomCode">รหัสห้อง</label>
        <input id="roomCode" class="input code" v-model="room" maxlength="7" autocomplete="off" autocapitalize="characters" placeholder="K7Q-X2M">
      </div>
      <div class="field">
        <label for="guestCode">รหัสส่วนตัว</label>
        <input id="guestCode" class="input code" v-model="guest" maxlength="9" autocomplete="off" autocapitalize="characters" placeholder="HX4P-9KTW">
      </div>
      <p class="err" v-if="error">{{ error }}</p>
      <button class="btn primary" type="submit" :disabled="busy">{{ busy ? 'กำลังเข้า…' : 'เข้าห้อง' }}</button>
      <div class="row muted small" style="gap: 10px"><span class="grow" style="height:1px;background:var(--line)"></span>หรือ<span class="grow" style="height:1px;background:var(--line)"></span></div>
      <button class="btn" type="button" @click="google">เข้าด้วย Google</button>
      <p class="small muted" style="margin: 0">เข้าด้วย Google เพื่อสร้างห้องเอง หรือเข้าห้องด้วยรหัสห้องอย่างเดียว</p>
    </form>
  </section>`,
};
