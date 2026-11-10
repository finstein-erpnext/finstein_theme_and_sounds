"""Rename the Frappe Module from "Fintheme and Sounds" to "Finstein Theme and Sounds".

The app was renamed ahead of its Frappe Marketplace listing: the Python
package is now `finstein_theme_and_sounds` and the module carries the full
product name. modules.txt and every DocType JSON already hold the new value;
this patch fixes sites installed under the old name so their `tabModule Def`
row, that row's `app_name`, and every DocType's `module` column line up with
it — otherwise the old row is left orphaned after sync_for_app.
"""

import frappe

OLD = "Fintheme and Sounds"
NEW = "Finstein Theme and Sounds"
APP = "finstein_theme_and_sounds"


def execute():
	if not frappe.db.exists("Module Def", OLD):
		# Fresh install — Frappe creates "Finstein Theme and Sounds" directly.
		_repoint_app_name()
		return

	if frappe.db.exists("Module Def", NEW):
		# Both rows exist: doctype sync already repointed to NEW, so just
		# repoint anything left and drop the orphaned OLD row.
		_repoint_doctypes()
		frappe.delete_doc("Module Def", OLD, ignore_permissions=True, force=True)
	else:
		frappe.rename_doc("Module Def", OLD, NEW, force=True, merge=False)
		_repoint_doctypes()

	_repoint_app_name()
	frappe.db.commit()


def _repoint_doctypes():
	frappe.db.sql(
		"UPDATE `tabDocType` SET module = %s WHERE module = %s",
		(NEW, OLD),
	)


def _repoint_app_name():
	"""Point the Module Def at the renamed Python package."""
	if frappe.db.exists("Module Def", NEW):
		frappe.db.set_value("Module Def", NEW, "app_name", APP, update_modified=False)
