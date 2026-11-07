import { ref, computed, onMounted, onUnmounted } from 'vue';
import { session, isGoogle, toast, signOut } from './store.js';
import JoinView from './views/JoinView.js';
import HomeView from './views/HomeView.js';
import RoomView from './views/RoomView.js';
import MeetupView from './views/MeetupView.js';
import MembersView from './views/MembersView.js';

// Routes live in the hash: #r-{room}, #m-{room}-{meetup}, #members-{room}, #j-{roomCode}-{guestCode}
function parse(hash) {
  const h = (hash || '').replace(/^#/, '');
  let m;
  if ((m = h.match(/^j-([A-Za-z0-9]{6})-([A-Za-z0-9]{8})$/))) return { name: 'join', roomCode: m[1].toUpperCase(), guestCode: m[2].toUpperCase() };
  if ((m = h.match(/^m-([A-Za-z0-9]+)-([A-Za-z0-9]+)$/))) return { name: 'meetup', roomId: m[1], meetId: m[2] };
  if ((m = h.match(/^members-([A-Za-z0-9]+)$/))) return { name: 'members', roomId: m[1] };
  if ((m = h.match(/^r-([A-Za-z0-9]+)$/))) return { name: 'room', roomId: m[1] };
  return { name: 'home' };
}

export default {
  name: 'App',
  components: { JoinView, HomeView, RoomView, MeetupView, MembersView },
  setup() {
    const route = ref(parse(location.hash));
    const onHash = () => { route.value = parse(location.hash); window.scrollTo(0, 0); };
    onMounted(() => window.addEventListener('hashchange', onHash));
    onUnmounted(() => window.removeEventListener('hashchange', onHash));

    const view = computed(() => {
      const r = route.value;
      if (!session.ready) return 'loading';
      if (r.name === 'join') return 'join';
      if (!session.user) return 'join';
      return r.name;
    });

    return { route, view, session, isGoogle, toast, signOut };
  },
  template: /* html */ `
  <main class="shell" :class="{ narrow: view === 'join' }">
    <header class="row between" v-if="view !== 'join' && view !== 'loading'">
      <a href="#" class="row" style="text-decoration: none; gap: 10px" aria-label="หน้าแรก">
        <span class="logo" aria-hidden="true" style="grid-template-columns: repeat(2, 10px); gap: 2px">
          <span style="width:10px;height:10px;background:#E5484D"></span><span style="width:10px;height:10px;background:#3E63DD"></span>
          <span style="width:10px;height:10px;background:#F5B100"></span><span style="width:10px;height:10px;background:#30A46C"></span>
        </span>
        <span class="display" style="font-size: 18px">ว่างไหม</span>
      </a>
      <div class="row">
        <span class="small muted" v-if="isGoogle && session.profile">{{ session.profile.name }}</span>
        <button class="btn sm ghost" @click="signOut">ออกจากระบบ</button>
      </div>
    </header>

    <p v-if="view === 'loading'" class="muted">กำลังโหลด…</p>
    <JoinView v-else-if="view === 'join'" :room-code="route.roomCode || ''" :guest-code="route.guestCode || ''" />
    <HomeView v-else-if="view === 'home'" />
    <RoomView v-else-if="view === 'room'" :room-id="route.roomId" />
    <MeetupView v-else-if="view === 'meetup'" :room-id="route.roomId" :meet-id="route.meetId" />
    <MembersView v-else-if="view === 'members'" :room-id="route.roomId" />

    <div class="toast" :class="toast.kind" v-if="toast.text" role="status">{{ toast.text }}</div>
  </main>`,
};
