import { useEffect, useState } from 'react';
import RolePicker from './RolePicker.jsx';
import Phone from './Phone.jsx';
import Scammer from './Scammer.jsx';

function useHashRoute() {
  const read = () => window.location.hash.replace(/^#/, '') || '/';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export default function App() {
  const route = useHashRoute();
  let page;
  if (route.startsWith('/phone')) page = <Phone />;
  else if (route.startsWith('/scammer')) page = <Scammer />;
  else page = <RolePicker />;
  return (
    <>
      {page}
      <div className="demo-mark">DEMO</div>
    </>
  );
}
