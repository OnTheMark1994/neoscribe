import "./Tabs.css";
import { useDispatch, useSelector } from 'react-redux';
import { closeTab, setActiveTabId } from '../../../../Global/ReduxSlices/TabsSlice';

function truncateWithEllipsis(text, maxChars) {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  if (maxChars <= 1) return "…";
  return text.slice(0, maxChars - 1) + "…";
}

export default function Tabs() {

  const dispatch = useDispatch();
  const tabs = useSelector(state => state.tabsSlice.tabs);
  const activeTabId = useSelector(state => state.tabsSlice.activeTabId);

  if (!tabs || tabs.length <= 1) {
    return null;
  }

  return (
    <div className="tabsBar">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className={"tab " + (isActive ? "tabActive" : "")}
            title={tab.filepath}
            onClick={()=>dispatch(setActiveTabId(tab.id))}
          >
            <div
              className={"tabCloseButton"}
              title={"Close " + tab.title}
              onClick={(event) => {
                event.stopPropagation();
                dispatch(closeTab(tab.id));
              }}
            >
              x
            </div>
            {truncateWithEllipsis(tab.title, 22)}
          </div>
        );
      })}
    </div>
  );
}
