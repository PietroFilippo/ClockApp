!include nsDialogs.nsh
!include LogicLib.nsh

!ifndef BUILD_UNINSTALLER
Var Dialog
Var Label
Var Checkbox_DesktopIcon
Var Checkbox_DesktopIcon_State
!endif

!macro customPageAfterChangeDir
  Page custom showDesktopIconOptions leaveDesktopIconOptions
!macroend

!ifndef BUILD_UNINSTALLER
Function showDesktopIconOptions
  nsDialogs::Create 1018
  Pop $Dialog
  ${If} $Dialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 24u "Select additional tasks you would like Setup to perform while installing $\r$\n${PRODUCT_NAME}, then click Install."
  Pop $Label

  ${NSD_CreateLabel} 0 30u 100% 12u "Additional icons:"
  Pop $Label

  ${NSD_CreateCheckbox} 10u 45u 100% 10u "Create a desktop icon"
  Pop $Checkbox_DesktopIcon

  # Default to checked
  ${NSD_Check} $Checkbox_DesktopIcon
  ${NSD_GetState} $Checkbox_DesktopIcon $Checkbox_DesktopIcon_State

  nsDialogs::Show
FunctionEnd

Function leaveDesktopIconOptions
  ${NSD_GetState} $Checkbox_DesktopIcon $Checkbox_DesktopIcon_State
FunctionEnd
!endif

!macro customInstall
  ${If} $Checkbox_DesktopIcon_State == ${BST_CHECKED}
    CreateShortCut "$DESKTOP\${SHORTCUT_NAME}.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  ${EndIf}
!macroend
