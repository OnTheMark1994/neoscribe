New overview:

Settings:

User Data:
in AppInitializer.js:
useEffect 
whenever the device id, or the auth object, anon id, or userDataReloadTrigger change it loads the user data via an api call and puts it in redux userSlice in userData
whenever any user data is needed (tokens, next billing data, etc) (not email or password though) this data is accessed through userData?.<attribute>
so in the ai chat window, account settings, etc we will always user this userData?. to show all data

Refresh button:
we will have a loadingUserData and userDataReloadTrigger in the user data slice 
a setter calle setLoadingUserData can set loadingUserData true or false
another one called reloadUserData increments the userDataReloadTrigger which is referenced in the useEffect in the app initializer
when the refresh button is clicked it dispatches the reload action
while loading = true the reload button will have the css class that makes it a bit darker and spinning to show that it is reloading

Settings:
in app initializer in its own userEffect for this a redux action in the settingsSlice is called to loadSettings
it pulls settings from localStorage settings object and puts it into redux state
like const savedSettings = localStorage.getItem("settingsObject") || {}
when we want to set a settings value we call a redux action in the settings slice called update setting
it takes the setting name and new value
setSetting("background", "path/thisimage.png")
it pulls settings from localStorage 
const currentSettings = localStorage.getItem("settingsObject") || {}
updates that object, updates the redux state object to that, and saves the updated object into localstorage
When referencing the settings we always use const 
settingsObject = useSelector(state => state.settingsSlice.settingsObject)
then settingsObject?.<attribute>
like
settingsObject?.showArrayEditorIndexValues ? ...
we have a settings menu with several tabs
settings slice stores the current settings, and also if the settings menu should show
the global state of showSettingsMenu is retrieved in the <SettingsMenu.js> and if it is true it will show the jsx
the settingsInitialTab is set in the openSettingsMenu action, if its set in the call that tab is put in redux and retrieved in the component to set the initial value of the menuTab local state in the settings menu, if it is not sent into the action then its set to null (and null makes the default tab show)
we have general, display, account, ai, developer (shows only when developer mode setting is true)
in display we have a foldable section for monaco view and for array view
we have showing or hiding the ids in the left of the lines, showing the preview scrollbar (monaco only), the sticky top bar (monaco only), font color, page background color (with html color pickers), etc. 
in ai we set the llm we want to use (this is sent to the api as a param and determines which llm api is called ex: deepseek which will be default) 


auth:
the it not stored anywhere in state or localstorage or anywher at all
we store the supabase auth user object in state (authUser)
we have a on auth state changed listener in initialize app that updates the redux whenever this changes
whenever we want to use the auth id anywhere in the file (sending it to an api, displaying in dev mode etc) we will use that object

user data:
we fetch directly from supabase in the initializer
the object we pull from there is pulls with useSelector and userd from that object directly with ?.
auth id is the highest form of id, then device id, and anon id is not really worth anything but in some cases that is the best we have. 
the apis take all 3 and decide which to use
ex: 
fetch(<api_url>/user-data)
body:{
    auth_id: <>, // best
    device_id: <>, // good for on device but no auth id yet
    anon_id: <>, // only in browser with no auth_id (not worh much but at least we have some record)
}

token usage:
the user sends data to a api to generate a response
it takes the previous conversation and the current state of the writing project as well as user ids into the api endpoint
the server sends this data to an ai llm api to generate a response to add to their writing project
if they currently have >=1 token it processes it
it calculates how manu tokens were used and updates the user table tokens values
it uses the monthly tokens first and then uses the tokens added
it updates the users table, responds with the response, including the things to add in the format defined in the prompt preface and also the new token values are its json response
this is used to update the user data in the response processing in the project so we don't need to make another call
the token values inmthe project user data are for display only, the actual decision about if we should or should not allow the user request to go to the llm api through the server is made on the server


Tables:
This is for context only 

// This is used to check on free grants to see if a user should be given free grants when creating accounts
CREATE TABLE public.free_grants (
  id bigint,
  created_at timestamp,
  auth_id text,
  device_id text,
  received_grant boolean,
  grant_amount bigint,
);

// Logs all token tranactions so users and admins can have a record of all transactions. 
// All actions that change token counts be done through a function that changes this 
CREATE TABLE public.token_log (
  id bigint,
  created_at timestamp,
  tokens bigint,
  user_id text,
  note text,
  tokens_monthly bigint,
  tokens_added bigint,
);

// keeps track of all user data
CREATE TABLE public.users (
  id bigint,
  created_at timestamp,
  name text,
  bio text,
  auth_id text UNIQUE,
  anon_id text,
  tokens_used_this_month bigint, // for display purpose only (this is the tokens used this monty)
  tokens_used_all_time bigint, // for display purpose only
  tokens_added bigint, // tokens user can use, consumed in api server logic, added with one time additions (one time packages, admin grants, etc)   
  email text,
  password text, // used for auto login link generation, not returned in user data api (need specific api called in account settings to get this to create the auto login link) 
  tier_id text, // the id of the tier (corresponds to a json in the server file that defines the tiers)
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text, // for display purpose only
  subscription_end_date text, // for display purpose only
  next_billing_date text, // for display purpose only
  tokens_monthly bigint, // tokens user can use added by stribe webhook when montly payments go through  
  device_id text, // for non auth users on a physical device (not browser)
  email_confirmed_at text, // email confirmation button pressed
  confirmation_token text, // not sure why this is here actually?
);


coding principles:

keep thins as simple and short as possible:
instead of selectors we will just use state.user.anonId in the files
not this: export const selectAnonId = (state) => state.user.anonId;, import and use that (unnecssary lines of code and complexity)

don't retype long things many times when a constant can be used
ex:
            .select('id, created_at, name, bio, auth_id, anon_id, tokens_used_this_month, tokens_used_all_time, tokens_added, tier_id, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_end_date, next_billing_date, tokens_monthly, device_id, email_confirmed_at, confirmation_token')
            (this is used several times)
    const userSelectString = 'id, created_at, name, bio, auth_id, anon_id, tokens_used_this_month, tokens_used_all_time, tokens_added, tier_id, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_end_date, next_billing_date, tokens_monthly, device_id, email_confirmed_at, confirmation_token'
    .select(userSelectString)

use ?. when accessing objects in case there is a null object to avoid errors