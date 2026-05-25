/**
 * app.js - Main Application Controller
 * Wires up game logic, touch interactions, UI, and event listeners.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize UI DOM caching and particles
  UI.init();

  // Initialize Touch Handler on the card container
  const touchHandler = new TouchHandler(UI.elements.cardContainer);

  // Setup screen state
  let selectedIntensity = 'mild';

  // ==========================================
  // 1. EVENT BINDING: SPLASH SCREEN
  // ==========================================
  UI.elements.btnStart.addEventListener('click', () => {
    hapticFeedback('light');
    UI.showScreen('screen-setup');
    UI.elements.playerNameInput.focus();
  });

  // ==========================================
  // 2. EVENT BINDING: SETUP SCREEN
  // ==========================================
  UI.elements.btnBackSplash.addEventListener('click', () => {
    hapticFeedback('light');
    UI.showScreen('screen-splash');
  });

  // Game Mode Selection Tab Logic
  const modeTabBtns = document.querySelectorAll('.mode-tab-btn');
  const setupPlayerSection = document.getElementById('setup-player-section');

  modeTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.mode;
      hapticFeedback('light');
      
      // Reset current game engine players
      game.resetGame();
      game.players = [];
      UI.renderPlayerList([]);
      
      if (mode === 'solo') {
        setupPlayerSection.style.display = 'none';
        game.addPlayer('Cả Nhóm');
      } else if (mode === 'duo') {
        setupPlayerSection.style.display = 'block';
        game.addPlayer('Người 1');
        game.addPlayer('Người 2');
        // Clear input to allow focus later
        UI.elements.playerNameInput.value = '';
      } else {
        // party (standard)
        setupPlayerSection.style.display = 'block';
        UI.elements.playerNameInput.value = '';
        UI.elements.playerNameInput.focus();
      }
    });
  });

  // Handle adding player via button click
  UI.elements.btnAddPlayer.addEventListener('click', () => {
    addPlayerFromInput();
  });

  // Handle adding player via Enter key in input
  UI.elements.playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addPlayerFromInput();
    }
  });

  function addPlayerFromInput() {
    const name = UI.elements.playerNameInput.value;
    const result = game.addPlayer(name);
    
    if (result.success) {
      hapticFeedback('light');
      UI.clearPlayerInput();
    } else {
      hapticFeedback('error');
      UI.showToast(result.error, 'error');
    }
  }

  // Handle removing a player
  UI.elements.playerList.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-remove-player')) {
      const playerId = e.target.dataset.id;
      game.removePlayer(playerId);
      hapticFeedback('light');
    }
  });

  // Handle intensity selection
  UI.elements.intensityBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      UI.elements.intensityBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedIntensity = btn.dataset.intensity;
      hapticFeedback('light');
    });
  });

  // Play button click
  UI.elements.btnPlay.addEventListener('click', () => {
    if (game.canStart) {
      // Gather active packs from checkboxes
      const checkedPacks = Array.from(document.querySelectorAll('.pack-checkbox:checked'))
        .map(cb => cb.value);

      if (checkedPacks.length === 0) {
        hapticFeedback('error');
        UI.showToast('Vui lòng chọn ít nhất 1 gói thử thách!', 'error');
        return;
      }

      hapticFeedback('success');
      game.startGame(selectedIntensity, checkedPacks);
    }
  });

  // ==========================================
  // 3. EVENT BINDING: GAME SCREEN
  // ==========================================
  
  // Flip button click
  UI.elements.btnFlip.addEventListener('click', () => {
    triggerCardFlip();
  });

  // Done button click
  UI.elements.btnDone.addEventListener('click', () => {
    hapticFeedback('success');
    game.completeChallenge();
  });

  // Drink button click
  UI.elements.btnDrink.addEventListener('click', () => {
    hapticFeedback('heavy');
    UI.shakeCard();
    game.drinkPenalty();
  });

  // Next card button click
  UI.elements.btnNext.addEventListener('click', () => {
    hapticFeedback('light');
    game.nextTurn();
  });

  // Scoreboard toggling
  UI.elements.btnScoreboard.addEventListener('click', () => {
    hapticFeedback('light');
    const rankings = game.getScoreboard();
    UI.renderScoreboard(rankings, 'scoreboard-list');
    UI.showModal('modal-scoreboard');
  });

  UI.elements.btnCloseScoreboard.addEventListener('click', () => {
    hapticFeedback('light');
    UI.hideModal('modal-scoreboard');
  });

  // NHIE Modal completion
  UI.elements.btnNhieDone.addEventListener('click', () => {
    hapticFeedback('light');
    const selectedPlayerIds = UI.getNhieSelectedPlayers();
    
    // Apply penalty to selected players
    if (selectedPlayerIds.length > 0) {
      game.addShotsToPlayers(selectedPlayerIds, game.currentCard.penalty);
    }
    
    UI.hideModal('modal-nhie');
    game.completeChallenge(); // Move to completion
  });

  // Vote Modal completion
  UI.elements.btnVoteDone.addEventListener('click', () => {
    hapticFeedback('light');
    const winnerIds = UI.getVoteResults();
    
    // Apply penalty to the voted players
    if (winnerIds.length > 0) {
      game.addShotsToPlayers(winnerIds, game.currentCard.penalty);
      
      // Notify who drinks
      const names = winnerIds.map(id => game.players.find(p => p.id === id).name).join(', ');
      UI.showToast(`Bình chọn nhiều nhất: ${names}! Uống phạt! 🥃`, 'info', 3000);
    }
    
    UI.hideModal('modal-vote');
    game.completeChallenge(); // Move to completion
  });

  // ==========================================
  // 4. TOUCH AND GESTURE INTERACTIONS
  // ==========================================

  // Tap on card triggers flip (if not flipped yet)
  touchHandler.on('tap', () => {
    if (game.state === GAME_STATES.PLAYING) {
      triggerCardFlip();
    }
  });

  // Swipe gesture support to discard/complete or drink
  touchHandler.on('swipeRight', () => {
    if (game.state === GAME_STATES.CARD_REVEAL && 
       (game.currentCard.type === 'truth' || game.currentCard.type === 'dare' || game.currentCard.type === 'group')) {
      hapticFeedback('success');
      // Swipe Right = Completed challenge
      const cardEl = UI.elements.gameCard;
      cardEl.style.transform = 'rotateY(180deg) translateX(300px) rotate(20deg)';
      cardEl.style.opacity = '0';
      cardEl.style.transition = 'all 0.5s ease-in';
      
      setTimeout(() => {
        cardEl.style.transform = '';
        cardEl.style.opacity = '';
        cardEl.style.transition = '';
        game.completeChallenge();
      }, 500);
    }
  });

  touchHandler.on('swipeLeft', () => {
    if (game.state === GAME_STATES.CARD_REVEAL && 
       (game.currentCard.type === 'truth' || game.currentCard.type === 'dare' || game.currentCard.type === 'group')) {
      hapticFeedback('heavy');
      UI.shakeCard();
      // Swipe Left = Skip / Drink
      const cardEl = UI.elements.gameCard;
      cardEl.style.transform = 'rotateY(180deg) translateX(-300px) rotate(-20deg)';
      cardEl.style.opacity = '0';
      cardEl.style.transition = 'all 0.5s ease-in';
      
      setTimeout(() => {
        cardEl.style.transform = '';
        cardEl.style.opacity = '';
        cardEl.style.transition = '';
        game.drinkPenalty();
      }, 500);
    }
  });

  function triggerCardFlip() {
    if (game.state !== GAME_STATES.PLAYING) return;
    
    // Draw first if not drawn yet
    const card = game.drawCard();
    if (card) {
      UI.renderCard(card);
      UI.flipCard();
      
      // Delay showing the response actions slightly to let the card flip complete
      setTimeout(() => {
        if (card.type === 'never_have_i_ever') {
          UI.renderNhieModal(card, game.players);
        } else if (card.type === 'vote') {
          UI.renderVoteModal(card, game.players);
        } else {
          UI.showPostFlipActions(card.type);
        }
      }, 600);
    }
  }

  // ==========================================
  // 5. GAME ENGINE EVENT LISTENERS (Reactive)
  // ==========================================
  
  game.on('playerAdded', (player) => {
    UI.renderPlayerList(game.players);
    UI.showToast(`Đã thêm ${player.name}`, 'success');
  });

  game.on('playerRemoved', (player) => {
    UI.renderPlayerList(game.players);
    UI.showToast(`Đã xóa ${player.name}`);
  });

  game.on('gameStarted', (data) => {
    UI.showScreen('screen-game');
    UI.resetCard();
    UI.updateCurrentPlayer(game.currentPlayer);
    UI.updateCardsRemaining(data.totalCards);
    UI.renderPlayerCarousel(game.players, game.currentPlayerIndex);
    UI.showToast('Bắt đầu game! Lượt đầu thuộc về ' + game.currentPlayer.name, 'success');
  });

  game.on('cardDrawn', (data) => {
    UI.updateCardsRemaining(data.remaining);
  });

  game.on('challengeCompleted', (data) => {
    UI.showToast(`${data.player.name} hoàn thành thử thách!`, 'success');
    UI.showNextButton();
  });

  game.on('penaltyDrunk', (data) => {
    UI.showToast(`${data.player.name} đã uống ${data.shots} shot! 🥃`, 'error');
    UI.showNextButton();
  });

  game.on('turnChanged', (data) => {
    UI.resetCard();
    UI.updateCurrentPlayer(data.player);
    UI.updateCardsRemaining(data.remaining);
    UI.renderPlayerCarousel(game.players, game.currentPlayerIndex);
  });

  game.on('gameOver', (data) => {
    hapticFeedback('success');
    UI.showGameOver(data.rankings);
  });

  // ==========================================
  // 6. EVENT BINDING: GAMEOVER SCREEN
  // ==========================================
  UI.elements.btnReplay.addEventListener('click', () => {
    hapticFeedback('light');
    const checkedPacks = Array.from(document.querySelectorAll('.pack-checkbox:checked'))
      .map(cb => cb.value);
    game.startGame(selectedIntensity, checkedPacks);
  });

  UI.elements.btnHome.addEventListener('click', () => {
    hapticFeedback('light');
    game.fullReset();
    UI.renderPlayerList([]);
    UI.showScreen('screen-splash');
  });
});
