## EasyEDA Professional Edition Extension: Update Schematic Component Attributes

[中文](./README.md)

Supports selecting a specified library, then batch-refreshing schematic component attribute parameters. It will look up the corresponding device library based on the schematic component's name or device name, and refresh the schematic component attributes.

![image1](images/image1.png)

Supports selecting a specified library, then batch-resetting devices. It will look up the corresponding device library based on the schematic component's name or device name, and perform batch replacement of the components.

![image](images/image.png)

```
Update Component Attributes
    |---Batch Update Component Attributes...
    |---Batch Replace Components...
    |---About...
```

# eext-update-components-attributes

## Safety and Rollback

- It is strongly recommended to back up data before the first run. After confirming that the changes meet expectations, save them. If the results do not meet expectations, you can directly click "Close" in the upper right corner and select "Do Not Save".

## Troubleshooting

- If no components are matched:
    - Check whether the device attributes are set correctly
    - Check whether the target library is correct
    - Check whether the document is read-only

## Contributing and Development

Contributions are welcome! Common ways to contribute include:

- Submitting issues to report bugs or suggest features.
- Submitting PRs to add new rules, improve performance, or add tests.
- Adding or improving documentation and examples.

Submission guidelines:

- Explain the purpose and impact of changes in the PR description.
- Add corresponding unit tests for new features or fixes (if a testing framework is available).

## License

Please check the LICENSE file in the root directory of this project for license terms. If there is no LICENSE file, please contact the repository maintainer to clarify authorization before using or distributing.

The main functions of this plugin can be divided into two categories:

1. Attribute Matching and Replacement

- Look up corresponding device attribute values in a specified library based on manufacturer part number, part number, supplier part number, or custom attribute values of schematic components.
- Batch replace the matched attributes in the library with user-specified attributes or attribute values.

2. Complete Device Replacement

- Match corresponding devices in the library through manufacturer part number, part number, supplier part number, or schematic custom attributes.
- After finding a matching device, the schematic component can be entirely replaced with the corresponding device from the library (including attributes, footprint, pin mapping, etc.)
