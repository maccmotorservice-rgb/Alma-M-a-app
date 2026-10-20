// Internal PDF tools; no messages are sent automatically.
import {initPdfSharing} from './pdf-share.js?v=66';
initPdfSharing({allowed:()=>!document.body.classList.contains('access-locked')});
