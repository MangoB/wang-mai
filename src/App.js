import { ref } from 'vue';
import ProfileGate from './components/ProfileGate.js';
import CalendarBoard from './components/CalendarBoard.js';
import DateVotes from './components/DateVotes.js';
import PlacesBoard from './components/PlacesBoard.js';
import ResetModal from './components/ResetModal.js';
import { status, meName, logout, toast } from './store.js';

export default {
  name: 'App',
  components: { ProfileGate, CalendarBoard, DateVotes, PlacesBoard, ResetModal },
  setup() {
    const resetOpen = ref(false);
    return { status, meName, logout, toast, resetOpen };
  },
  template: `
  <div class="wrap">
    <header class="top">
      <div class="brand">
        <h1>ว่างไหม</h1>
        <p>ลงวันว่าง เสนอที่นัด แล้วโหวตกัน</p>
      </div>
      <div class="who" v-if="meName">
        <span class="dot"></span><span>กรอกในชื่อ <b>{{ meName }}</b></span>
        <span class="saving" v-if="status.saving">{{ status.saving }}</span>
        <button class="btn ghost sm" @click="logout">เปลี่ยนชื่อ</button>
      </div>
    </header>

    <div class="banner" v-if="status.error">{{ status.error }}</div>

    <ProfileGate v-if="!meName" />
    <CalendarBoard />
    <DateVotes />
    <PlacesBoard />

    <footer class="foot">
      <p>นัดรอบนี้สำเร็จแล้ว? เริ่มรอบใหม่เพื่อล้างวันว่าง สถานที่ และโหวตของทุกคน</p>
      <button class="btn danger-outline" @click="resetOpen = true" :disabled="!status.connected">เริ่มนัดรอบใหม่</button>
    </footer>

    <ResetModal :open="resetOpen" @close="resetOpen = false" />
    <div class="toast" v-if="toast" role="status">{{ toast }}</div>
  </div>`,
};
