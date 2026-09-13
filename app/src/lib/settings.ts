import { createContext, useContext } from 'react'
import { DEFAULT_SETTINGS } from '../../public/admin/settings.js'
import { SERVICES } from './services'
export type Service = {id:string;title:string;group:string;hero:boolean;detail:string}
export type SiteSettings = typeof DEFAULT_SETTINGS
export const SettingsContext = createContext({settings:DEFAULT_SETTINGS, services:[...SERVICES] as Service[]})
export const useSiteSettings = () => useContext(SettingsContext)
