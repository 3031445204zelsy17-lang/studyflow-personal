// HKMU Campus User Manager - Cross-module login state sharing

(function(window) {
    'use strict';

    var STORAGE_KEY = 'hkmu_campus_user';
    var SESSION_KEY = 'hkmu_campus_session';

    // Default avatar SVG
    var DEFAULT_AVATAR = 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">' +
        '<rect width="80" height="80" fill="#E3F2FD"/>' +
        '<circle cx="40" cy="30" r="12" fill="#0066CC"/>' +
        '<ellipse cx="40" cy="55" rx="16" ry="12" fill="#0066CC"/>' +
        '</svg>'
    );

    class CampusUserManager {
        constructor() {
            this.user = null;
            this.listeners = [];
            this.loadUser();
        }

        // Load user from localStorage
        loadUser() {
            try {
                var data = localStorage.getItem(STORAGE_KEY);
                if (data) {
                    this.user = JSON.parse(data);
                    if (!this.user.avatar) {
                        this.user.avatar = DEFAULT_AVATAR;
                    }
                }
            } catch (e) {
                console.error('Failed to load user:', e);
                this.user = null;
            }
        }

        // Save user to localStorage
        saveUser() {
            try {
                if (this.user) {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.user));
                    localStorage.setItem(SESSION_KEY, JSON.stringify({
                        loggedIn: true,
                        timestamp: Date.now()
                    }));
                } else {
                    localStorage.removeItem(STORAGE_KEY);
                    localStorage.removeItem(SESSION_KEY);
                }
            } catch (e) {
                console.error('Failed to save user:', e);
            }
        }

        // User login
        login(userData) {
            this.user = {
                studentId: userData.studentId || '',
                nickname: userData.nickname || 'Anonymous',
                avatar: userData.avatar || DEFAULT_AVATAR,
                loginTime: new Date().toISOString(),
                loggedIn: true
            };
            this.saveUser();
            this.notifyListeners('login', this.user);
        }

        // User logout
        logout() {
            var oldUser = this.user;
            this.user = null;
            this.saveUser();
            this.notifyListeners('logout', oldUser);
        }

        // Update user info
        updateUser(updates) {
            if (this.user) {
                Object.assign(this.user, updates);
                this.saveUser();
                this.notifyListeners('update', this.user);
            }
        }

        // Get current user
        getUser() {
            return this.user;
        }

        // Check if logged in
        isLoggedIn() {
            return this.user !== null && this.user.loggedIn === true;
        }

        // Get display name
        getDisplayName() {
            return this.user ? (this.user.nickname || 'Anonymous') : 'Guest';
        }

        // Get avatar
        getAvatar() {
            return this.user ? (this.user.avatar || DEFAULT_AVATAR) : DEFAULT_AVATAR;
        }

        // Listen for state changes, returns unsubscribe function
        onChange(callback) {
            this.listeners.push(callback);
            return function() {
                this.listeners = this.listeners.filter(function(cb) { return cb !== callback; });
            }.bind(this);
        }

        // Notify all listeners
        notifyListeners(event, data) {
            this.listeners.forEach(function(callback) {
                try {
                    callback(event, data);
                } catch (e) {
                    console.error('Listener error:', e);
                }
            });
        }

        // Check if login prompt should show
        showLoginPrompt() {
            var shouldShow = !sessionStorage.getItem('loginPromptShown');
            if (shouldShow && !this.isLoggedIn()) {
                sessionStorage.setItem('loginPromptShown', 'true');
                return true;
            }
            return false;
        }
    }

    // Create global singleton
    var campusUser = new CampusUserManager();

    // Export to window
    window.CampusUser = campusUser;

    // Backward compatible alias
    window.campusUser = campusUser;

    // Trigger ready event on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            window.dispatchEvent(new CustomEvent('campusUserReady', {
                detail: campusUser
            }));
        });
    } else {
        window.dispatchEvent(new CustomEvent('campusUserReady', {
            detail: campusUser
        }));
    }

    console.log('HKMU Campus User Manager loaded');

})(window);
