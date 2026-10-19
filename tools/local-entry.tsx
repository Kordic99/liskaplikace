import React from 'react';
import {createRoot} from 'react-dom/client';
import Archive from '../app/Archive';
import {enableLocal} from '../app/local';
enableLocal();
const bookId=new URLSearchParams(location.search).get('book')??undefined;
createRoot(document.getElementById('root')!).render(<Archive bookId={bookId}/>);
