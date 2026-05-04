import React from "react";
import Button from "./Button";

const IconButton = React.forwardRef(function IconButton(
  { variant = "ghost", ...rest },
  ref
) {
  return <Button ref={ref} variant={variant} iconOnly {...rest} />;
});

export default IconButton;
