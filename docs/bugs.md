bugs

presing tab does not line it up
  if there  is a space it will be misaligned, still moving it over by a tab amount but one space off
  maybe backspace on a tab filled line should delete entire tab not just the space

undo redo (don)
  the ctrl z and ctrl y undo redo are not working proprely, not untoing or redoing some things but are with others and not in order and not in the right places. please figure out why 
  Undo/redo problems in CodeMirror 6 almost always come from one of these:
  History extension missing (history() + historyKeymap) so the browser/native undo partially interferes.
  Custom transactions not annotated (especially your custom Enter handler) so changes don’t get grouped / recorded the same way as normal typing.
  Multiple dispatches per “one action” which makes undo feel out-of-order.
  import { history, historyKeymap } from '@codemirror/commands';

settings (done)
  preset names to paper and glass
  
enter same tab level (done)
when a user presses enter we want the tab level to be the same on the next line
ex
line one
  line two (presses enter)
  cursor goes here automatially (has the tab)

no fold all button (for foldable sections) (done)
it does not save the folded state in the file (maybe on desktop it does?)

fold area (done)
better to
ex:
principles
  repetition
  repetition 
  engage emotions
  |pictures  

|the l 
x 
    aa  
    aa     
   
unsaved work alert (done)
when there is unsaved work in the browser editor show an alert to ask the user if they want to save their work

(done)
tab indent spaces does not show on the next line for word wrap
for example if the line wraps and it has one indent the wrapped part on the next line starts all the way to the left (not indented)
  this is the line and the page ends here
and it wrapps to here on the same line now al the way to the left instead of tabbed in   



ctrl f 
does not scroll it into view, does scroll it but not all the way, seems the viewport calc is off 
ctrl f does not show x of y count 
when in ctrl f mode:
highlight moves scroll down even when not going outside of the input area
the ctrl f things is changing the viewport shomehow, and it goes back to normal when ctrl f is gone


