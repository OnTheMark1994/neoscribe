import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setFullscreenActive, toggleFullscreenActive } from './ReduxSlices/MenuSlice';

// This all seems to be related to the F11 full screen on off functionality
export default function KeypressListeners() {
  const dispatch = useDispatch();
  const fullscreenActive = useSelector(state => state.menuSlice.fullscreenActive);

  // Full screen on off listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenElement =
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement;
      dispatch(setFullscreenActive(!!fullscreenElement));
    };

    const handleKeyDown = (e) => {
      if (e.key !== 'F11') return;

      // Prevent the browser's default fullscreen behavior so we can manage it ourselves.
      e.preventDefault();
      dispatch(toggleFullscreenActive());
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    document.addEventListener('keydown', handleKeyDown);

    handleFullscreenChange();

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dispatch]);

  useEffect(() => {
    const getFullscreenElement = () =>
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement;

    const isCurrentlyFullscreen = !!getFullscreenElement();

    if (fullscreenActive === isCurrentlyFullscreen) return;

    const doc = document;
    const docEl = doc.documentElement;

    if (fullscreenActive) {
      const request =
        docEl.requestFullscreen ||
        docEl.webkitRequestFullscreen ||
        docEl.mozRequestFullScreen ||
        docEl.msRequestFullscreen;
      if (request) {
        Promise.resolve(request.call(docEl)).catch(() => {
          dispatch(setFullscreenActive(false));
        });
      } else {
        dispatch(setFullscreenActive(false));
      }
    } else {
      const exit =
        doc.exitFullscreen ||
        doc.webkitExitFullscreen ||
        doc.mozCancelFullScreen ||
        doc.msExitFullscreen;
      if (exit) {
        Promise.resolve(exit.call(doc)).catch(() => {
          dispatch(setFullscreenActive(true));
        });
      }
    }
  }, [dispatch, fullscreenActive]);

  return null;
}
