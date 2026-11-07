import { ref, computed, onMounted, onUnmounted } from 'vue';
import { session, isGoogle, toast, signOut } from './store.js';
import WelcomeView from './views/WelcomeView.js';
import HomeView from './views/HomeView.js';
import GangView from './views/GangView.js';
import ManageView from './views/ManageView.js';
import MeetupView from './views/MeetupView.js';
import AcceptView from './views/AcceptView.js';

// Routes live in the hash (code-side a gang is still a "room"):
//   #r-{gang}  #manage-{gang}  #m-{gang}-{meetup}  #g-{gangCode} (gang link)  #j-{gangCode}-{personalCode} (personal link)
function parse(hash) {
  const h = (hash || '').replace(/^#/, '');
  let m;
  if ((m = h.match(/^j-([A-Za-z0-9]{6})-([A-Za-z0-9]{8})$/))) return { name: 'join', roomCode: m[1].toUpperCase(), guestCode: m[2].toUpperCase() };
  if ((m = h.match(/^g-([A-Za-z0-9]{6})$/))) return { name: 'accept', code: m[1].toUpperCase() };
  if ((m = h.match(/^m-([A-Za-z0-9]+)-([A-Za-z0-9]+)$/))) return { name: 'meetup', roomId: m[1], meetId: m[2] };
  if ((m = h.match(/^manage-([A-Za-z0-9]+)$/))) return { name: 'manage', roomId: m[1] };
  if ((m = h.match(/^r-([A-Za-z0-9]+)$/))) return { name: 'room', roomId: m[1] };
  return { name: 'home' };
}

export default {
  name: 'App',
  components: { WelcomeView, HomeView, GangView, ManageView, MeetupView, AcceptView },
  setup() {
    const route = ref(parse(location.hash));
    const onHash = () => { route.value = parse(location.hash); window.scrollTo(0, 0); };
    onMounted(() => window.addEventListener('hashchange', onHash));
    onUnmounted(() => window.removeEventListener('hashchange', onHash));

    const view = computed(() => {
      const r = route.value;
      if (!session.ready) return 'loading';
      if (r.name === 'join') return 'welcome';
      if (r.name === 'accept') return 'accept';
      if (!session.user) return 'welcome';
      return r.name;
    });

    return { route, view, session, isGoogle, toast, signOut };
  },
  template: /* html */ `
  <main class="shell" :class="{ narrow: view === 'welcome' || view === 'accept' }">
    <header class="row between" v-if="view !== 'welcome' && view !== 'loading' && session.user">
      <a href="#" class="row" style="text-decoration: none; gap: 10px" aria-label="หน้าแรก">
        <span class="logo" aria-hidden="true" style="grid-template-columns: repeat(2, 10px); gap: 2px">
          <span style="width:10px;height:10px;background:#E5484D"></span><span style="width:10px;height:10px;background:#3E63DD"></span>
          <span style="width:10px;height:10px;background:#F5B100"></span><span style="width:10px;height:10px;background:#30A46C"></span>
        </span>
        <span class="display" style="font-size: 18px">ว่างไหม</span>
      </a>
      <div class="row">
        <span class="small muted" v-if="isGoogle && session.profile">{{ session.profile.name }}</span>
        <!-- Without Google, signing out would lose the identity behind personal links on this device. -->
        <button v-if="isGoogle" class="btn sm ghost" @click="signOut">ออกจากระบบ</button>
      </div>
    </header>

    <p v-if="view === 'loading'" class="muted">กำลังโหลด…</p>
    <WelcomeView v-else-if="view === 'welcome'" :room-code="route.roomCode || ''" :guest-code="route.guestCode || ''" />
    <AcceptView v-else-if="view === 'accept'" :code="route.code" />
    <HomeView v-else-if="view === 'home'" />
    <GangView v-else-if="view === 'room'" :room-id="route.roomId" />
    <ManageView v-else-if="view === 'manage'" :room-id="route.roomId" />
    <MeetupView v-else-if="view === 'meetup'" :room-id="route.roomId" :meet-id="route.meetId" />

    <div class="toast" :class="toast.kind" v-if="toast.text" role="status">{{ toast.text }}</div>
  </main>`,
};
