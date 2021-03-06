import Whiteboard from '../classes/Whiteboard.js';
import initializeToolsMenu from '../tools.js';
import initializeCanvasTopMenu from './canvasTopMenu.js';
import initializeManagerChat from './managerChat.js';
import initializeBoards, { emitBoards } from './managerBoards.js';
import initializeActionsMenu from './canvasActions.js';
import { initializeManagerMedia, initializeManagerRTC, changeStatus } from './managerRTC.js';
import {
  getUrlId, reloadWindow, copyTextToClipboard, saveCurrentBoard,
} from '../utility.js';

const managerId = getUrlId();
const hasAudio = $('#audioValidator').val() === 'true';
const hasWebcam = $('#webcamValidator').val() === 'true';
const hasWhiteboard = $('#whiteboardValidator').val() === 'true';
const roomId = $('#_id').val();

function beginLecture(stream) {
  const socket = io('/', { query: `id=${managerId}` });
  const whiteboard = hasWhiteboard ? new Whiteboard('canvas') : null;
  const canvasStream = hasWhiteboard ? whiteboard.getStream() : null;

  if (hasWhiteboard) {
    socket.on('currentBoard', (studentSocketId) => {
      socket.emit('currentBoard', {
        boardImg: whiteboard.getImage(),
        studentSocket: studentSocketId,
      });
    });
  }

  socket.on('disconnect', changeStatus.connection_lost);

  socket.on('attemptToConnectMultipleManagers', () => {
    window.location.replace('/error?code=2');
  });

  $(window).on('beforeunload', () => {
    socket.emit('send-to-room', roomId, { left: $('#host-name-chat').val() });
    if (hasWhiteboard) {
      saveCurrentBoard(whiteboard);
      emitBoards(socket, whiteboard); 
    }
    socket.disconnect();
  });

  socket.on('invalidLecture', reloadWindow);

  socket.on('ready', (room) => {
    if (hasWhiteboard) {
      const { boards, boardActive } = room.lecture_details;
      whiteboard.initialize();
      initializeToolsMenu(whiteboard);
      initializeActionsMenu(socket, whiteboard, canvasStream);
      initializeBoards(socket, whiteboard, boards, boardActive, canvasStream);
    }
    initializeCanvasTopMenu(socket, room.lecture_details.id);
    initializeManagerChat(socket, room.lecture_details.id);
    initializeManagerRTC(stream, canvasStream);
  });
}

window.onload = () => {
  $('#modal-copy-link').click(function () {
    const copyText = document.querySelector('.modal-url-share');
    copyTextToClipboard(copyText.innerText);
    const range = document.createRange();
    range.selectNodeContents(copyText);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    this.innerHTML = $('#copied-info').val();
    this.style.opacity = 1;
    setTimeout(() => {
      this.style.opacity = 0.83;
      this.innerHTML = $('#copy-info').val();
      selection.removeAllRanges();
    }, 2000);
  });

  if (!(hasAudio || hasWebcam)) $('#modal-select-button').css('margin-bottom', '30px');
  $('#welcome-lecture-modal').show();

  changeStatus.starting();
  initializeManagerMedia((stream) => {
    $('#modal-select-button').removeClass('live-button-inactive').find('.ld').fadeOut(function () {
      $(this).parent().find('span').fadeIn();
    });

    $('#modal-select-button').click(() => {
      fetch(`/validate/lecture?id=${roomId}`).then((req) => {
        switch (req.status) {
          case 200:
            beginLecture(stream);
            $('#welcome-lecture-modal').hide();
            break;
          case 404:
            window.location.replace('/error?code=1');
            break;
          case 401:
            window.location.replace('/error?code=2');
            break;
          default: break;
        }
      });
    });
  });
};
