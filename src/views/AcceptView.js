import { ref, reactive, watch } from 'vue';
import {
  session, isGoogle, peekGangLink, isInGang, joinWithRoomCode, signInGoogle, setPendingGang, say, explain,
} from '../store.js';
import ProfileForm from '../components/ProfileForm.js';

// #g-<รหัสแก๊ง>: "แก๊ง X ชวนคุณ" → รับคำชวน (Google) or ไว้ก่อน (shows up on the home page).
export default {
  name: 'AcceptView',
  components: { ProfileForm },
  props: { code: String },
  setup(props) {
    const gang = reactive({ loaded: false, roomId: '', name: '', error: '' });
    const busy = ref(false);

    watch(() => props.code, async (code) => {
      Object.assign(gang, { loaded: false, roomId: '', name: '', error: '' });
      try {
        const g = await peekGangLink(code);
        if (!g) { gang.error = 'ลิงก์แก๊งนี้ใช้ไม่ได้แล้ว ขอลิงก์ใหม่จากคนที่ชวน'; }
        else {
          Object.assign(gang, g);
          if (isGoogle.value && await isInGang(g.roomId)) { setPendingGang(null); location.hash = '#r-' + g.roomId; return; }
        }
      } catch (e) { gang.error = explain(e); }
      gang.loaded = true;
    }, { immediate: true });

    async function accept() {
      if (!isGoogle.value) { await signInGoogle(); return; }
      if (!session.profile) return; // the profile form shows first
      busy.value = true;
      try {
        const id = await joinWithRoomCode(props.code);
        setPendingGang(null);
        say('เข้าแก๊งแล้ว');
        location.hash = '#r-' + id;
      } catch (e) { say(e.code ? explain(e) : e.message, 'error'); }
      busy.value = false;
    }
    function later() {
      setPendingGang({ code: props.code, name: gang.name });
      location.hash = '';
    }
    return { session, isGoogle, gang, busy, accept, later };
  },
  template: /* html */ `
  <section class="stack" style="gap: 18px; padding-top: 24px">
    <p v-if="!gang.loaded" class="muted">กำลังเปิดคำชวน…</p>
    <div v-else-if="gang.error" class="sheet">
      <p style="margin: 0">{{ gang.error }}</p>
      <a href="#" class="btn">ไปหน้าแรก</a>
    </div>
    <template v-else>
      <ProfileForm v-if="isGoogle && session.profileLoaded && !session.profile" title="ก่อนเข้าแก๊ง ตั้งชื่อกับสีของคุณ" />
      <div v-else class="sheet outlined stack" style="align-items: center; text-align: center; gap: 12px; padding: 28px 20px">
        <span class="small muted">คุณได้รับคำชวนเข้าแก๊ง</span>
        <h1 style="font-size: 32px">{{ gang.name || 'แก๊งเพื่อน' }}</h1>
        <button class="btn primary" style="width: 100%" :disabled="busy" @click="accept">
          {{ isGoogle ? (busy ? 'กำลังเข้า…' : 'รับคำชวน') : 'ล็อกอินด้วย Google แล้วรับคำชวน' }}
        </button>
        <button class="btn" style="width: 100%" @click="later">ไว้ก่อน</button>
        <span v-if="isGoogle && session.profile" class="small muted">เข้าในชื่อ <b>{{ session.profile.name }}</b> · สีเปลี่ยนได้ในจัดการแก๊ง</span>
        <span v-else class="small muted">ไม่มี Google? ขอลิงก์ส่วนตัวจากคนที่ชวนแทนได้</span>
      </div>
    </template>
  </section>`,
};
