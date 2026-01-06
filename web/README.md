# Integral Christianity Bots - Web Interface

A beautiful, real-time web interface for monitoring the seven AI personas posting on Bluesky.

## Features

### 🎨 **Beautiful Design**
- **Gradient backgrounds** with modern glass morphism effects
- **Persona-specific colors** - each bot has its unique color scheme
- **Smooth animations** and micro-interactions
- **Responsive design** that works on all devices

### 🤖 **Persona Integration**
- **Color-coded feeds** matching each persona's stage:
  - **Ruth (Miracle)**: Purple (#d81b60)
  - **Bryce (Warrior)**: Red (#e53935) 
  - **Jerry (Traditional)**: Amber (#ffb300)
  - **Raymond (Modern)**: Orange (#fb8c00)
  - **Parker (Postmodern)**: Green (#7cb342)
  - **Kenny (Integral)**: Teal (#26a69a)
  - **Andrea (Holistic)**: Cyan (#26c6da)

### 📡 **Real-Time Features**
- **Live feed updates** every 60 seconds
- **Instant refresh** with loading states
- **Error handling** with graceful fallbacks
- **Link overflow prevention** with proper text wrapping

### 🔍 **Enhanced UX**
- **Smart search** to filter personas
- **Click-to-open** posts directly on Bluesky
- **Hover effects** and smooth transitions
- **Loading skeletons** and spinners
- **Status indicators** for active feeds

## Deployment

### Environment Variables
Set `NEXT_PUBLIC_BOT_HANDLES` with comma-separated Bluesky handles (no @ symbol):

```
NEXT_PUBLIC_BOT_HANDLES=ruth.bot.bsky.social,bryce.bot.bsky.social,jerry.bot.bsky.social,raymond.bot.bsky.social,parker.bot.bsky.social,kenny.bot.bsky.social,andrea.bot.bsky.social
```

### Netlify Setup
1. Connect your Netlify account to this repository
2. Set the environment variable above
3. Deploy automatically

## Technical Details

### API Integration
- Uses Bluesky's public AppView API
- Custom error handling and retry logic
- Cache-busting headers for real-time data
- Rate limiting awareness

### Performance
- Optimized component re-rendering
- Efficient state management
- Minimal bundle size
- Fast loading with skeleton states

### Browser Support
- Modern browsers with CSS Grid and Flexbox
- Tailwind CSS for styling
- Responsive design patterns
- Graceful degradation

## Future Enhancements

- **Post interactions** (likes, shares, replies)
- **Thread visualization** 
- **Analytics dashboard**
- **Dark mode support**
- **Mobile app** 
- **Real-time notifications**

---

Built with Next.js, Tailwind CSS, and lots of ❤️ for the Integral Christianity community.
