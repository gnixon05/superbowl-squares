# Super Bowl Squares

A full-stack web application for managing Super Bowl square pool games. Built with React, Express, and SQLite.

## Features

- User registration and authentication (JWT)
- Create and join Super Bowl square games
- Interactive 5x5 grid with click-to-pick squares
- Each grid position assigned 2 numbers (0-9, all digits used)
- Per-quarter scoring (Q1, Q2, Q3, Final) with automatic winner detection
- Dashboard with "My Games" and public games to join
- **Private games** with email invitations and join request approval
- **Payment support** — free or paid games with configurable cost per square
- **Venmo/Braintree integration** — in-app payments via Braintree SDK with Venmo support
- **Automatic payouts** — game creators can initiate per-quarter payouts to winners
- Stats page with leaderboard and recent results
- Profile management with avatar selection
- Mobile-first responsive design (Bootstrap 5)

## Tech Stack

- **Frontend:** React 19, Vite, React Router 7, React-Bootstrap
- **Backend:** Express 5, Node.js
- **Database:** SQLite (better-sqlite3)
- **Auth:** JWT + bcrypt
- **Payments:** Braintree SDK (Venmo)

## Local Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Clone the repo
git clone https://github.com/gnixon05/superbowl-squares.git
cd superbowl-squares

# Install all dependencies
npm run install-all

# Create environment file
nano .env
```

Add the following to `.env`:
```
JWT_SECRET=your-random-secret-key-here
PORT=5000

# Optional: Braintree/Venmo payments (only needed for integrated payment games)
BRAINTREE_ENVIRONMENT=sandbox
BRAINTREE_MERCHANT_ID=your-merchant-id
BRAINTREE_PUBLIC_KEY=your-public-key
BRAINTREE_PRIVATE_KEY=your-private-key
```

Generate a secure secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Start the development servers:
```bash
# Run in development mode (Express + Vite dev server)
npm run dev
```

The app will be available at `http://localhost:3000` (Vite proxies API requests to Express on port 5000).

## Deploying to AWS EC2

### Recommended Instance

- **Instance type:** t3.micro (free tier eligible) or t3.small for more headroom
- **AMI:** Amazon Linux 2023 or Ubuntu 24.04 LTS
- **Storage:** 8 GB gp3 (default is fine)

### Step 1: Launch an EC2 Instance

1. Log into the [AWS Console](https://console.aws.amazon.com/) and go to **EC2 > Launch Instance**
2. Choose **Amazon Linux 2023** AMI (or Ubuntu 24.04 LTS)
3. Select **t3.micro** instance type
4. Create or select a **key pair** for SSH access (download the `.pem` file)
5. Under **Network settings**, create a security group with these inbound rules:
   - **SSH (port 22):** Your IP only
   - **HTTP (port 80):** Anywhere (0.0.0.0/0)
   - **HTTPS (port 443):** Anywhere (0.0.0.0/0)
6. Launch the instance

### Step 2: Connect to Your Instance

```bash
# Make your key file read-only
chmod 400 your-key.pem

# SSH into the instance
ssh -i your-key.pem ec2-user@your-instance-public-ip
# For Ubuntu: ssh -i your-key.pem ubuntu@your-instance-public-ip
```

### Step 3: Install Node.js

**Amazon Linux 2023:**
```bash
sudo dnf install -y nodejs20 npm git
```

**Ubuntu 24.04:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
```

Verify the installation:
```bash
node --version   # Should be v20.x or higher
npm --version
```

### Step 4: Clone and Set Up the App

```bash
# Clone your repo
git clone https://github.com/gnixon05/superbowl-squares.git
cd superbowl-squares

# Install dependencies
npm run install-all

# Build the React frontend for production
npm run build

# Create the environment file
nano .env
```

Add the following to `.env`:
```
JWT_SECRET=your-generated-secret-here
PORT=5000
```

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Test that the server starts:
```bash
node server/index.js
# Should print: Server running on port 5000
# Press Ctrl+C to stop
```

### Step 5: Set Up PM2 (Process Manager)

PM2 keeps the app running in the background and auto-restarts on crashes or reboots.

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the app with PM2
pm2 start server/index.js --name superbowl-squares

# Set PM2 to start on boot
pm2 startup
# Run the command it outputs (starts with "sudo env...")
pm2 save

# Useful PM2 commands
pm2 status              # Check app status
pm2 logs                # View logs
pm2 restart superbowl-squares  # Restart the app
```

### Step 6: Set Up Nginx as a Reverse Proxy

Nginx sits in front of Express to handle port 80/443 and serve the app on standard HTTP ports.

**Amazon Linux 2023:**
```bash
sudo dnf install -y nginx
```

**Ubuntu 24.04:**
```bash
sudo apt-get install -y nginx
```

Create the Nginx config:

```bash
sudo nano /etc/nginx/conf.d/superbowl-squares.conf
```

Paste the following (replace `your-domain-or-ip` with your EC2 public IP or domain name):

```nginx
server {
    listen 80;
    server_name your-domain-or-ip;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Amazon Linux 2023** — remove the default server block that conflicts:
```bash
sudo sed -i '/^[^#]*listen.*80/,/}/d' /etc/nginx/nginx.conf
```

Test and start Nginx:
```bash
sudo nginx -t            # Test config (should say "OK")
sudo systemctl start nginx
sudo systemctl enable nginx
```

Your app should now be accessible at `http://your-ec2-public-ip`.

### Step 7 (Optional): Set Up HTTPS with Let's Encrypt

If you have a domain name pointed at your EC2 instance:

```bash
# Install certbot
# Amazon Linux 2023:
sudo dnf install -y certbot python3-certbot-nginx

# Ubuntu 24.04:
sudo apt-get install -y certbot python3-certbot-nginx

# Get and install the certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is set up automatically. Test it with:
sudo certbot renew --dry-run
```

### Step 8: Updating the App

When you push new code:

```bash
cd ~/superbowl-squares
git pull origin main
npm run install-all
npm run build
pm2 restart superbowl-squares
```

## Project Structure

```
superbowl-squares/
  server/
    index.js              # Express entry point
    config/db.js          # SQLite setup and migrations
    middleware/auth.js     # JWT auth middleware
    routes/
      auth.js             # Register, login, current user
      users.js            # Profile endpoints
      games.js            # Game CRUD, square picking, scoring
  client/
    src/
      components/         # Navbar, ProtectedRoute
      context/            # AuthContext (JWT state)
      pages/              # Home, SignIn, SignUp, Dashboard,
                          # GameBoard, Profile, Stats
      services/api.js     # Axios instance with auth interceptor
```

## Game Flow

1. **Create** — A user creates a game, picks two NFL teams
2. **Pick Squares** — Users click empty squares to claim them (numbers hidden as "?")
3. **Lock Board** — Creator locks the board; random number pairs (0-9) are assigned to each row/column position
4. **Score Quarters** — Creator enters the score after Q1, Q2, Q3, and Final; a winner is auto-determined for each
5. **Complete** — After the Final score, the game is marked complete with all 4 winners displayed
