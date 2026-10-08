// Unknown route (old link, typo): web sends these to "/", so does native.
import { Redirect } from "expo-router";

export default function NotFound() { return <Redirect href="/" />; }
