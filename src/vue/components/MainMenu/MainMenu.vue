<template>
  <div class="MainMenu__container">
    <div class="MainMenu">
      <div class="MainMenu__title --bold">STAR DEFENDER</div>
      <div class="MainMenu__close" @click="$emit('close')"></div>
      <img src="/gui/images/main-menu/main-menu-background.png">
      <div class="MainMenu__items" ref="menuItems">
        <div 
          v-for="(item, index) in items" 
          :key="index" 
          :class="[
            'MainMenu__item', 
            { 'MainMenu__item--selected': item.text == selectedItem },
            { 'MainMenu__item--disabled': item.text === 'SEARCH GAME' }
          ]"
          :style="{ opacity: item.opacity }"
          @click="item.text !== 'SEARCH GAME' && selectItem(item.text)"
        >
          {{ item.text }}
        </div>
      </div>
      <div class="MainMenu__items-boxshadow"></div> 
      
    </div>
  </div>
</template>

<script lang="ts">
export default {
  name: 'MainMenu',
  props: {
    selectedItem: {
      type: String,
    }
  },
  data() {
    return {
      items: [
        { text: 'SEARCH GAME', opacity: 1, selected: false },
        { text: 'DUEL', opacity: 1, selected: true },
        { text: 'PLAY WITH A BOT', opacity: 1, selected: false },
        { text: 'LEADERS BOARD', opacity: 1, selected: false },
        { text: 'QUESTS', opacity: 1, selected: false },
        { text: 'SETTINGS', opacity: 1, selected: false },
      ],
      isScrolling: false,
      lastY: 0,
      velocity: 0,
      friction: 0.95, // Adjust this for smoother or faster deceleration
      requestID: null,
    };
  },
  mounted() {
    const menuItems = this.$refs.menuItems;

    menuItems.addEventListener('touchstart', (e) => {
      this.isScrolling = false;
      this.lastY = e.touches[0].pageY;
      this.velocity = 0;
      if (this.requestID) {
        cancelAnimationFrame(this.requestID); // Stop any ongoing animations
      }
    });

    menuItems.addEventListener('touchmove', (e) => {
      const currentY = e.touches[0].pageY;
      this.velocity = currentY - this.lastY; // Calculate velocity based on distance moved
      menuItems.scrollTop -= this.velocity; // Apply movement
      this.lastY = currentY;
      e.preventDefault();
    });

    menuItems.addEventListener('touchend', () => {
      this.isScrolling = true;
      this.applyMomentumScroll(menuItems);
    });
  },
  methods: {
    selectItem(name: string) {
      this.items.forEach(item => {
        item.selected = item.text === name;
      });
      this.$emit('selectItem', name); 
    },
    applyMomentumScroll(element) {
      const threshold = 0.1; // Minimum speed to stop animation

      const step = () => {
        if (Math.abs(this.velocity) > threshold) {
          element.scrollTop -= this.velocity; // Move scroll position by current velocity
          this.velocity *= this.friction; // Apply friction to reduce velocity
          this.requestID = requestAnimationFrame(step); // Continue the animation
        } else {
          cancelAnimationFrame(this.requestID); // Stop when below threshold
          this.isScrolling = false;
        }
      };

      this.requestID = requestAnimationFrame(step);
    },
  },
  beforeDestroy() {
    if (this.requestID) {
      cancelAnimationFrame(this.requestID);
    }
  }
};
</script>



<style scoped src="./MainMenu.css"></style>
