/*
  Auth state listner
    puts supbase auth user object into redux
    sets a flag to show if it finished attempting to load this yet or not so other functions know what to do 

  user data loading
    loads the user data into the user data redux slice to be used all over the application
    called in useEffect that runs after the auth user object attempts to load 
      (so when the user object changes, when the attepmted auth loading flag changes, when the reload user data redux trigger changes)
      runs even if there is no auth user, but auth user check happens first
    uses a custom api that takes the auth id, device id, anon id all as params

  loading user data
    flag used show show if the user data is loading for display purposes 

  Other data
    if there is other data that loads on initilazation we will add it here
 
 */
export default function AppInitializer() {
  return (
    <div>
      
    </div>
  );
}
